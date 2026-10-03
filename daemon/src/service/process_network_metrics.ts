import { ChildProcess, execFile, spawn } from "child_process";
import { performance } from "perf_hooks";
import { promisify } from "util";
import logger from "./log";

const execute = promisify(execFile);
export interface ProcessTraffic {
  rxBytes: number;
  txBytes: number;
}
export interface ProcessNetworkSample {
  timestamp: number;
  counters: Map<number, ProcessTraffic>;
}

export function parseNettop(output: string): Map<number, ProcessTraffic> {
  const result = new Map<number, ProcessTraffic>();
  const lines = output.trim().split("\n");
  const headers = (lines.shift() || "").split(",");
  const rx = headers.indexOf("bytes_in");
  const tx = headers.indexOf("bytes_out");
  if (rx < 0 || tx < 0) throw new Error("Unsupported nettop output");
  for (const line of lines) {
    const fields = line.split(",");
    const pid = fields[0]?.match(/\.(\d+)$/);
    const rxBytes = Number(fields[rx]);
    const txBytes = Number(fields[tx]);
    if (pid && Number.isFinite(rxBytes) && Number.isFinite(txBytes) && rxBytes >= 0 && txBytes >= 0)
      result.set(Number(pid[1]), { rxBytes, txBytes });
  }
  return result;
}

export function parseNethogsLine(line: string) {
  // Parse from the right: executable paths may contain spaces and slashes.
  const match = line.match(/\/(\d+)\/\d+\s+([\d.]+)\s+([\d.]+)\s*$/);
  if (!match) return;
  const pid = Number(match[1]);
  const txBytes = Number(match[2]);
  const rxBytes = Number(match[3]);
  if (pid > 0 && Number.isFinite(rxBytes) && Number.isFinite(txBytes))
    return { pid, rxBytes, txBytes };
}

// One optional OS collector per daemon, regardless of the number of instances.
export class ProcessNetworkMetrics {
  private subscribers = 0;
  private child?: ChildProcess;
  private sample?: ProcessNetworkSample;
  private request?: Promise<ProcessNetworkSample | undefined>;
  private requestTimestamp = 0;
  private retryAfter = 0;
  private failed = false;

  constructor(private platform: NodeJS.Platform = process.platform) {}

  subscribe() {
    this.subscribers++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.subscribers = Math.max(0, this.subscribers - 1);
      if (this.subscribers) return;
      const child = this.child;
      this.child = undefined;
      // Forcefully stop only our collector; nethogs can block waiting for packets.
      child?.kill("SIGKILL");
      this.sample = undefined;
      this.request = undefined;
      this.retryAfter = 0;
      this.failed = false;
    };
  }

  private reportFailure() {
    if (!this.failed)
      logger.warn(
        this.platform === "linux"
          ? "Per-process network metrics unavailable. On Linux, install nethogs with TCP/UDP (-C) support and grant capture permissions."
          : "Per-process network metrics unavailable: the OS collector failed."
      );
    this.failed = true;
    this.retryAfter = Date.now() + 60000;
    this.sample = undefined;
  }

  private startLinuxCollector() {
    if (this.child || Date.now() < this.retryAfter || !this.subscribers) return;
    const child = spawn("nethogs", ["-t", "-v", "2", "-d", "2", "-C"], {
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true
    });
    this.child = child;
    let buffer = "";
    let counters: Map<number, ProcessTraffic> | undefined;
    child.stdout?.on("data", (chunk: Buffer) => {
      if (this.child !== child) return;
      buffer += chunk.toString();
      if (buffer.length > 2 * 1024 * 1024) {
        this.reportFailure();
        child.kill("SIGKILL");
        return;
      }
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim() === "Refreshing:") {
          if (counters) {
            this.sample = { counters, timestamp: performance.now() };
            this.failed = false;
          }
          counters = new Map();
          continue;
        }
        const item = parseNethogsLine(line);
        if (!item || !counters) continue;
        if (counters.size >= 16384) {
          this.reportFailure();
          child.kill("SIGKILL");
          return;
        }
        const previous = counters.get(item.pid);
        counters.set(item.pid, {
          rxBytes: (previous?.rxBytes || 0) + item.rxBytes,
          txBytes: (previous?.txBytes || 0) + item.txBytes
        });
      }
    });
    const failed = () => {
      if (this.child !== child) return;
      this.child = undefined;
      this.reportFailure();
    };
    child.on("error", failed);
    child.on("exit", failed);
  }

  async read(): Promise<ProcessNetworkSample | undefined> {
    if (!this.subscribers) return;
    if (this.platform === "linux") {
      this.startLinuxCollector();
      if (this.sample && performance.now() - this.sample.timestamp < 10000) return this.sample;
      return;
    }
    if (this.platform !== "darwin" || Date.now() < this.retryAfter) return;
    if (!this.request || Date.now() - this.requestTimestamp >= 3000) {
      this.requestTimestamp = Date.now();
      this.request = execute(
        "/usr/bin/nettop",
        ["-P", "-L", "1", "-n", "-x", "-J", "bytes_in,bytes_out"],
        {
          timeout: 2000,
          maxBuffer: 2 * 1024 * 1024
        }
      )
        .then(({ stdout }) => {
          this.failed = false;
          return { counters: parseNettop(stdout), timestamp: performance.now() };
        })
        .catch(() => {
          this.reportFailure();
          return undefined;
        });
    }
    return this.request;
  }
}

export const processNetworkMetrics = new ProcessNetworkMetrics();

// Keep totals for the current run when sockets close or child processes exit.
export class InstanceTrafficCounter {
  private previous?: ProcessNetworkSample;
  private rxBytes = 0;
  private txBytes = 0;

  update(sample: ProcessNetworkSample, pids: number[]) {
    if (this.previous && sample.timestamp <= this.previous.timestamp) return;
    let rxDelta = 0;
    let txDelta = 0;
    const current = new Map<number, ProcessTraffic>();
    for (const pid of pids) {
      const last = this.previous?.counters.get(pid);
      const value = sample.counters.get(pid) || last;
      if (!value) continue;
      current.set(pid, value);
      // Establish a baseline for new PIDs rather than counting old socket traffic.
      if (last) {
        rxDelta += Math.max(0, value.rxBytes - last.rxBytes);
        txDelta += Math.max(0, value.txBytes - last.txBytes);
      }
    }
    const seconds = this.previous ? (sample.timestamp - this.previous.timestamp) / 1000 : 0;
    this.rxBytes += rxDelta;
    this.txBytes += txDelta;
    this.previous = { timestamp: sample.timestamp, counters: current };
    return {
      rxBytes: this.rxBytes,
      txBytes: this.txBytes,
      rxRate: seconds ? rxDelta / seconds : undefined,
      txRate: seconds ? txDelta / seconds : undefined
    };
  }
}
