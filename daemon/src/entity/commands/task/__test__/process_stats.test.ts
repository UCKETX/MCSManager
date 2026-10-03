import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../../service/process_metrics", () => ({ sampleProcessMetrics: vi.fn() }));
vi.mock("../../../../service/process_network_metrics", () => ({
  processNetworkMetrics: { subscribe: vi.fn(), read: vi.fn() },
  InstanceTrafficCounter: class {
    update() {
      return { rxRate: 0, txRate: 0, rxBytes: 0, txBytes: 0 };
    }
  }
}));
vi.mock("../../../../service/log", () => ({ default: { warn: vi.fn() } }));
import { sampleProcessMetrics } from "../../../../service/process_metrics";
import { processNetworkMetrics } from "../../../../service/process_network_metrics";
import ProcessStatsTask from "../process_stats";

describe("process resource lifecycle", () => {
  let instance: any;
  let task: ProcessStatsTask;
  const release = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    instance = {
      instanceUuid: "test",
      config: { processType: "general" },
      process: { pid: 123 },
      info: {}
    };
    task = new ProcessStatsTask();
    vi.mocked(processNetworkMetrics.subscribe).mockReturnValue(release);
    vi.mocked(sampleProcessMetrics).mockResolvedValue({
      cpuUsage: 12,
      memoryUsage: 1024,
      pids: [123]
    });
    vi.mocked(processNetworkMetrics.read).mockResolvedValue(undefined);
  });
  afterEach(async () => {
    await task.stop(instance);
    vi.useRealTimers();
  });
  it("samples immediately, refreshes and releases resources on stop", async () => {
    await task.start(instance);
    await vi.advanceTimersByTimeAsync(0);
    expect(instance.info).toMatchObject({ cpuUsage: 12, memoryUsage: 1024 });
    await vi.advanceTimersByTimeAsync(4000);
    expect(sampleProcessMetrics).toHaveBeenCalledTimes(2);
    await task.stop(instance);
    expect(release).toHaveBeenCalledTimes(1);
    expect(instance.info.cpuUsage).toBeUndefined();
    await vi.advanceTimersByTimeAsync(4000);
    expect(sampleProcessMetrics).toHaveBeenCalledTimes(2);
  });
  it("does not overlap slow samples or publish a sample from a stopped run", async () => {
    let finish!: (value: any) => void;
    vi.mocked(sampleProcessMetrics).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    await task.start(instance);
    await vi.advanceTimersByTimeAsync(8000);
    expect(sampleProcessMetrics).toHaveBeenCalledTimes(1);
    await task.stop(instance);
    finish({ cpuUsage: 99, memoryUsage: 999, pids: [123] });
    await vi.advanceTimersByTimeAsync(0);
    expect(instance.info.cpuUsage).toBeUndefined();
    instance.process.pid = 456;
    await task.start(instance);
    await vi.advanceTimersByTimeAsync(0);
    expect(instance.info.cpuUsage).toBe(12);
  });
  it("leaves Docker monitoring to the existing Docker task", async () => {
    instance.config.processType = "docker";
    await task.start(instance);
    expect(sampleProcessMetrics).not.toHaveBeenCalled();
    expect(processNetworkMetrics.subscribe).not.toHaveBeenCalled();
  });
});
