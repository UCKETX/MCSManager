// @vitest-environment jsdom
import { createApp, defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFileTree } from "../useFileTree";

const execute = vi.hoisted(() => vi.fn());
vi.mock("@/services/apis/fileManager", () => ({ fileList: () => ({ execute }) }));
vi.mock("@/lang/i18n", () => ({ t: (key: string) => key }));
vi.mock("@/tools/validator", () => ({ reportErrorMsg: vi.fn() }));
let tree: ReturnType<typeof useFileTree>;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  vi.resetAllMocks();
  execute.mockResolvedValue({
    value: {
      items: [
        { name: "config.json", type: 1, size: 2 },
        { name: "plugins", type: 0, size: 0 }
      ],
      pageSize: 100,
      total: 2
    }
  });
  app = createApp(
    defineComponent({
      setup() {
        tree = useFileTree("node", "instance", "/");
        return () => h("div");
      }
    })
  );
  app.mount(document.createElement("div"));
});
afterEach(() => app.unmount());

describe("workspace directory tree", () => {
  it("never loads file leaves and does not repeat loaded directory requests", async () => {
    await tree.refresh();
    await tree.loadDirectory(tree.findNode("/config.json")!);
    await tree.loadDirectory(tree.nodes.value[0]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("replaces ancestors when loading a child so Ant Tree can rebuild its key map", async () => {
    await tree.refresh();
    const root = tree.nodes.value[0];
    const folder = tree.findNode("/plugins")!;
    await tree.loadDirectory(folder);
    expect(tree.nodes.value[0]).not.toBe(root);
    expect(tree.findNode("/plugins")).not.toBe(folder);
    expect(tree.findNode("/plugins/config.json")?.isLeaf).toBe(true);
    expect(folder.children).toBeUndefined();
  });
});
