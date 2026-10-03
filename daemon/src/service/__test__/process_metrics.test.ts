import { describe, expect, it, vi, beforeEach } from "vitest";
import { collectProcessTree, sampleProcessMetrics } from "../process_metrics";

vi.mock("pidusage", () => ({ default: vi.fn() }));
vi.mock("child_process", () => ({
  execFile: Object.assign(() => {}, {
    [Symbol.for("nodejs.util.promisify.custom")]: async () => ({
      stdout: "10 1\n11 10\n12 11\n99 1\n",
      stderr: ""
    })
  })
}));
import pidusage from "pidusage";

describe("instance process metrics", () => {
  beforeEach(() => vi.resetAllMocks());
  it("includes descendants while excluding unrelated host processes and tolerating cycles", () => {
    expect(
      collectProcessTree(
        10,
        new Map([
          [10, 12],
          [11, 10],
          [12, 11],
          [99, 1]
        ])
      )
    ).toEqual([10, 11, 12]);
    expect(() => collectProcessTree(1, new Map([[99, 1]]))).toThrow();
    expect(() => collectProcessTree(-1, new Map())).toThrow();
  });
  it("sums CPU and memory, tolerates exited children and requires the root", async () => {
    vi.mocked(pidusage).mockResolvedValue({
      10: { cpu: 1.25, memory: 1024 },
      12: { cpu: 150, memory: 2048 }
    } as any);
    expect(await sampleProcessMetrics(10)).toEqual({
      cpuUsage: 151.25,
      memoryUsage: 3072,
      pids: [10, 12]
    });
    expect(pidusage).toHaveBeenCalledWith([10, 11, 12]);
    vi.mocked(pidusage).mockResolvedValue({ 12: { cpu: 1, memory: 1 } } as any);
    await expect(sampleProcessMetrics(10)).rejects.toThrow();
  });
  it("rejects malformed metrics instead of sending NaN to the terminal", async () => {
    vi.mocked(pidusage).mockResolvedValue({ 10: { cpu: NaN, memory: 1 } } as any);
    await expect(sampleProcessMetrics(10)).rejects.toThrow();
  });
});
