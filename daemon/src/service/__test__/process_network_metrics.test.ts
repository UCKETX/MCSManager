import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "events";
import { spawn } from "child_process";
vi.mock("child_process", async () => ({
  ...(await vi.importActual<any>("child_process")),
  spawn: vi.fn()
}));
vi.mock("../log", () => ({ default: { warn: vi.fn() } }));
import {
  InstanceTrafficCounter,
  ProcessNetworkMetrics,
  parseNettop,
  parseNethogsLine
} from "../process_network_metrics";

describe("per-process network metrics", () => {
  it("reads NetHogs byte totals from the correct upload/download columns", () => {
    expect(parseNethogsLine("/path with spaces/server/123/1000\t400\t900")).toEqual({
      pid: 123,
      txBytes: 400,
      rxBytes: 900
    });
    expect(parseNethogsLine("unknown TCP/0/0\t9999\t9999")).toBeUndefined();
    expect(parseNethogsLine("Refreshing:")).toBeUndefined();
  });
  it("parses nettop by header names, not fixed column ordering", () => {
    const rows = parseNettop(
      ",bytes_out,bytes_in,\nnode.123,400,900,\nbad,0,0,\nnode.456,NaN,12,\n"
    );
    expect([...rows]).toEqual([[123, { rxBytes: 900, txBytes: 400 }]]);
    expect(() => parseNettop("invalid columns")).toThrow();
  });
  it("isolates instance PIDs, uses byte deltas and retains totals after children exit", () => {
    const counter = new InstanceTrafficCounter();
    const first = {
      timestamp: 1000,
      counters: new Map([
        [10, { rxBytes: 100, txBytes: 200 }],
        [99, { rxBytes: 9999, txBytes: 9999 }]
      ])
    };
    expect(counter.update(first, [10])?.rxRate).toBeUndefined();
    const second = {
      timestamp: 5000,
      counters: new Map([
        [10, { rxBytes: 500, txBytes: 1000 }],
        [11, { rxBytes: 100, txBytes: 50 }],
        [99, { rxBytes: 999999, txBytes: 999999 }]
      ])
    };
    expect(counter.update(second, [10, 11])).toEqual({
      rxBytes: 400,
      txBytes: 800,
      rxRate: 100,
      txRate: 200
    });
    expect(counter.update(second, [10, 11])).toBeUndefined();
    expect(
      counter.update(
        { timestamp: 9000, counters: new Map([[10, { rxBytes: 550, txBytes: 1200 }]]) },
        [10]
      )
    ).toEqual({ rxBytes: 450, txBytes: 1000, rxRate: 12.5, txRate: 50 });
  });
  it("never reports negative rates when OS counters reset", () => {
    const counter = new InstanceTrafficCounter();
    counter.update({ timestamp: 1, counters: new Map([[10, { rxBytes: 100, txBytes: 200 }]]) }, [
      10
    ]);
    expect(
      counter.update({ timestamp: 1001, counters: new Map([[10, { rxBytes: 10, txBytes: 20 }]]) }, [
        10
      ])
    ).toEqual({ rxBytes: 0, txBytes: 0, rxRate: 0, txRate: 0 });
  });
  it("does not double count a still-running PID after a temporarily missing row", () => {
    const counter = new InstanceTrafficCounter();
    counter.update({ timestamp: 1, counters: new Map([[10, { rxBytes: 100, txBytes: 200 }]]) }, [
      10
    ]);
    counter.update({ timestamp: 1001, counters: new Map() }, [10]);
    expect(
      counter.update(
        { timestamp: 2001, counters: new Map([[10, { rxBytes: 110, txBytes: 220 }]]) },
        [10]
      )
    ).toEqual({ rxBytes: 10, txBytes: 20, rxRate: 10, txRate: 20 });
  });
  it("shares one Linux collector, parses fragmented frames and releases it after the last subscriber", async () => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), kill: vi.fn() });
    vi.mocked(spawn).mockReturnValue(child as any);
    const collector = new ProcessNetworkMetrics("linux");
    const release1 = collector.subscribe();
    const release2 = collector.subscribe();
    try {
      expect(await collector.read()).toBeUndefined();
      await collector.read();
      expect(spawn).toHaveBeenLastCalledWith(
        "nethogs",
        ["-t", "-v", "2", "-d", "2", "-C"],
        expect.any(Object)
      );
      child.stdout.emit("data", Buffer.from("Refreshing:\n/server/10/1000\t20\t"));
      child.stdout.emit("data", Buffer.from("40\n/server/10/1000\t10\t5\nRefreshing:\n"));
      expect((await collector.read())?.counters.get(10)).toEqual({ txBytes: 30, rxBytes: 45 });
      release1();
      release1();
      expect(child.kill).not.toHaveBeenCalled();
      release2();
      expect(child.kill).toHaveBeenCalledOnce();
      expect(await collector.read()).toBeUndefined();
    } finally {
      release1();
      release2();
    }
  });
  it("returns unavailable and backs off after a Linux collector error", async () => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), kill: vi.fn() });
    vi.mocked(spawn)
      .mockClear()
      .mockReturnValue(child as any);
    const collector = new ProcessNetworkMetrics("linux");
    const release = collector.subscribe();
    try {
      await collector.read();
      child.emit("error", new Error("ENOENT"));
      expect(await collector.read()).toBeUndefined();
      expect(spawn).toHaveBeenCalledOnce();
    } finally {
      release();
    }
  });
});
