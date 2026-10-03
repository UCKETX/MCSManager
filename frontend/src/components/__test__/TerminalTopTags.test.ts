// @vitest-environment jsdom
import { createApp, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import TerminalTopTags from "../TerminalTopTags.vue";
vi.mock("@/lang/i18n", () => ({ t: (key: string) => key }));
let app: ReturnType<typeof createApp>;
let container: HTMLElement;
const mount = (info: any, isStopped = false) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  app = createApp({ render: () => h(TerminalTopTags, { info, isStopped }) });
  app.component("ATag", {
    render() {
      return h("span", this.$attrs, this.$slots.default?.());
    }
  });
  app.mount(container);
};
afterEach(() => {
  app?.unmount();
  container?.remove();
});
describe("terminal instance resource tags", () => {
  it("preserves fractional CPU usage for lightly loaded instances", () => {
    mount({ cpuUsage: 0.5, memoryUsage: 1024 });
    expect(container.textContent).toContain("0.5%");
  });
  it("shows real zero CPU and network values even on a narrow screen", () => {
    vi.stubGlobal("innerWidth", 390);
    mount({ cpuUsage: 0, memoryUsage: 1024, rxRate: 0, txRate: 1000, rxBytes: 0, txBytes: 2000 });
    expect(container.textContent).toContain("0%");
    expect(container.textContent).toContain("TXT_CODE_NETWORK_CURRENT");
    expect(container.textContent).toContain("↑1.00 kB/s");
    expect(container.textContent).toContain("TXT_CODE_NETWORK_TOTAL");
    vi.unstubAllGlobals();
  });
  it("marks missing network data as unavailable instead of zero", () => {
    mount({ cpuUsage: 1, memoryUsage: 2048 });
    expect(container.textContent).toContain("↓— ↑—");
    expect(
      container.querySelector('[title="TXT_CODE_INSTANCE_NETWORK_UNAVAILABLE"]')
    ).not.toBeNull();
  });
  it("hides stale metrics after the instance stops", () => {
    mount({ cpuUsage: 99, memoryUsage: 4096, rxRate: 999, txRate: 999 }, true);
    expect(container.textContent).toBe("");
  });
});
