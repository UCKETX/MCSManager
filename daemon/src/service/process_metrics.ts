import { execFile } from "child_process";
import pidusage from "pidusage";
import { promisify } from "util";

const execute = promisify(execFile);
const MAX_PROCESSES = 1024;
let treeRequest: Promise<Map<number, number>> | undefined;
let treeTimestamp = 0;

export function collectProcessTree(root: number, parents: Map<number, number>): number[] {
  if (!Number.isSafeInteger(root) || root <= 0 || !parents.has(root))
    throw new Error("Instance process is no longer available");
  const children = new Map<number, number[]>();
  for (const [pid, parent] of parents) {
    const siblings = children.get(parent) || [];
    siblings.push(pid);
    children.set(parent, siblings);
  }
  const result = [root];
  const seen = new Set(result);
  for (let index = 0; index < result.length; index++) {
    for (const child of children.get(result[index]) || []) {
      if (seen.has(child)) continue;
      if (result.length >= MAX_PROCESSES)
        throw new Error("Instance process tree exceeds monitor limit");
      seen.add(child);
      result.push(child);
    }
  }
  return result;
}

async function readProcessParents() {
  const parents = new Map<number, number>();
  const options = { timeout: 3000, maxBuffer: 2 * 1024 * 1024, windowsHide: true };
  if (process.platform === "win32") {
    const { stdout } = await execute(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress"
      ],
      options
    );
    const rows = JSON.parse(stdout);
    for (const row of Array.isArray(rows) ? rows : [rows]) {
      if (Number.isSafeInteger(row.ProcessId) && Number.isSafeInteger(row.ParentProcessId))
        parents.set(row.ProcessId, row.ParentProcessId);
    }
  } else {
    const { stdout } = await execute("ps", ["-axo", "pid=,ppid="], options);
    for (const line of stdout.split("\n")) {
      const match = line.trim().match(/^(\d+)\s+(\d+)$/);
      if (match) parents.set(Number(match[1]), Number(match[2]));
    }
  }
  return parents;
}

// Share the host's PID/PPID scan across active instances, never expose the table to clients.
async function getProcessParents() {
  if (!treeRequest || Date.now() - treeTimestamp >= 3000) {
    treeTimestamp = Date.now();
    treeRequest = readProcessParents();
  }
  return treeRequest;
}

export async function sampleProcessMetrics(root: number) {
  const pids = collectProcessTree(root, await getProcessParents());
  // pidusage returns partial results if children exit; require the root below.
  // Use its default backend consistently with the existing process-info command.
  const stats = await pidusage(pids);
  if (!stats[root]) throw new Error("Instance process exited during resource sampling");
  let cpuUsage = 0;
  let memoryUsage = 0;
  const alivePids: number[] = [];
  for (const pid of pids) {
    const item = stats[pid];
    if (!item) continue;
    if (!Number.isFinite(item.cpu) || !Number.isFinite(item.memory) || item.memory < 0)
      throw new Error("Invalid process resource sample");
    cpuUsage += Math.max(0, item.cpu);
    memoryUsage += item.memory;
    alivePids.push(pid);
  }
  return { cpuUsage, memoryUsage, pids: alivePids };
}
