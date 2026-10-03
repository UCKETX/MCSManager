import { sampleProcessMetrics } from "../../../service/process_metrics";
import {
  InstanceTrafficCounter,
  processNetworkMetrics
} from "../../../service/process_network_metrics";
import logger from "../../../service/log";
import Instance from "../../instance/instance";
import { ILifeCycleTask } from "../../instance/life_cycle";

export default class ProcessStatsTask implements ILifeCycleTask {
  public name = "ProcessStats";
  public status = 0;
  private timer?: NodeJS.Timeout;
  private generation = 0;
  private updating = false;
  private failed = false;
  private unsubscribe?: () => void;
  private traffic = new InstanceTrafficCounter();

  private async update(instance: Instance, pid: number, generation: number) {
    if (this.updating || generation !== this.generation) return;
    this.updating = true;
    try {
      const metrics = await sampleProcessMetrics(pid);
      const network = await processNetworkMetrics.read();
      if (generation !== this.generation || Number(instance.process?.pid) !== pid) return;
      const rates = network ? this.traffic.update(network, metrics.pids) : undefined;
      instance.info = {
        ...instance.info,
        cpuUsage: metrics.cpuUsage,
        memoryUsage: metrics.memoryUsage,
        ...(network
          ? rates
          : { rxBytes: undefined, txBytes: undefined, rxRate: undefined, txRate: undefined })
      };
      this.failed = false;
    } catch (error: any) {
      if (generation !== this.generation) return;
      instance.info = {
        ...instance.info,
        cpuUsage: undefined,
        memoryUsage: undefined,
        rxBytes: undefined,
        txBytes: undefined,
        rxRate: undefined,
        txRate: undefined
      };
      if (!this.failed)
        logger.warn(`Instance ${instance.instanceUuid} resource sampling failed: ${error.message}`);
      this.failed = true;
    } finally {
      if (generation === this.generation) this.updating = false;
    }
  }

  async start(instance: Instance) {
    if (instance.config.processType === "docker") return;
    const pid = Number(instance.process?.pid);
    if (!Number.isSafeInteger(pid) || pid <= 0) return;
    // stop() clears synchronously; do not yield before capturing this run's generation.
    void this.stop(instance);
    const generation = this.generation;
    this.unsubscribe = processNetworkMetrics.subscribe();
    this.timer = setInterval(() => void this.update(instance, pid, generation), 4000);
    void this.update(instance, pid, generation);
  }

  async stop(instance: Instance) {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.updating = false;
    this.failed = false;
    this.traffic = new InstanceTrafficCounter();
    instance.info = {
      ...instance.info,
      cpuUsage: undefined,
      memoryUsage: undefined,
      memoryUsagePercent: undefined,
      memoryLimit: undefined,
      rxBytes: undefined,
      txBytes: undefined,
      rxRate: undefined,
      txRate: undefined
    };
  }
}
