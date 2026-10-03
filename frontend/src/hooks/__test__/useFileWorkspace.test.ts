// @vitest-environment jsdom
import { createApp, defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDocumentDirty, useFileWorkspace } from "../useFileWorkspace";
import { readWorkspaceFile, writeWorkspaceFile } from "@/services/apis/fileManager";

vi.mock("@/services/apis/fileManager", () => ({
  readWorkspaceFile: vi.fn(),
  writeWorkspaceFile: vi.fn()
}));
vi.mock("@/lang/i18n", () => ({ t: (key: string) => key }));
vi.mock("@/tools/validator", () => ({ reportErrorMsg: vi.fn() }));

const snapshot = (text = "original", revision = "a".repeat(64), conflict = false) => ({
  text,
  revision,
  encoding: "utf-8",
  conflict
});
let workspace: ReturnType<typeof useFileWorkspace>;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readWorkspaceFile).mockResolvedValue(snapshot());
  vi.mocked(writeWorkspaceFile).mockResolvedValue(snapshot("changed", "b".repeat(64)));
  app = createApp(
    defineComponent({
      setup() {
        workspace = useFileWorkspace("node", "instance");
        return () => h("div");
      }
    })
  );
  app.mount(document.createElement("div"));
});
afterEach(() => app.unmount());

describe("file workspace", () => {
  it("does not focus a stale open request that finishes after another file", async () => {
    let resolve!: (_value: ReturnType<typeof snapshot>) => void;
    vi.mocked(readWorkspaceFile).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );
    const first = workspace.openFile("/slow.yml");
    await workspace.openFile("/latest.yml");
    resolve(snapshot());
    await first;
    expect(workspace.activePath.value).toBe("/latest.yml");
    expect(workspace.documents.value).toHaveLength(2);
  });
  it("deduplicates opening requests and retains content while switching files", async () => {
    await Promise.all([workspace.openFile("/a.yml"), workspace.openFile("/a.yml")]);
    expect(readWorkspaceFile).toHaveBeenCalledTimes(1);
    workspace.updateText("/a.yml", "unsaved");
    await workspace.openFile("/b.yml");
    await workspace.openFile("/a.yml");
    expect(workspace.activeDocument.value?.text).toBe("unsaved");
    expect(workspace.documents.value).toHaveLength(2);
  });

  it("keeps edits made during an in-flight save dirty", async () => {
    await workspace.openFile("/a.txt");
    workspace.updateText("/a.txt", "submitted");
    let resolve!: (value: ReturnType<typeof snapshot>) => void;
    vi.mocked(writeWorkspaceFile).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );
    const saving = workspace.saveFile();
    workspace.updateText("/a.txt", "typed during save");
    resolve(snapshot("submitted", "b".repeat(64)));
    expect(await saving).toBe(true);
    expect(workspace.activeDocument.value?.savedText).toBe("submitted");
    expect(workspace.activeDocument.value?.text).toBe("typed during save");
    expect(workspace.hasUnsaved.value).toBe(true);
  });

  it("retains local text on conflict and overwrites only against the reviewed revision", async () => {
    await workspace.openFile("/a.txt");
    workspace.updateText("/a.txt", "local");
    vi.mocked(writeWorkspaceFile).mockResolvedValueOnce(snapshot("disk", "c".repeat(64), true));
    expect(await workspace.saveFile()).toBe(false);
    expect(workspace.activeDocument.value?.text).toBe("local");
    expect(workspace.conflict.value?.remote.text).toBe("disk");
    expect(isDocumentDirty(workspace.activeDocument.value!)).toBe(true);
    await workspace.saveFile(
      workspace.conflict.value!.document,
      workspace.conflict.value!.remote.revision
    );
    expect(writeWorkspaceFile).toHaveBeenLastCalledWith(
      "node",
      "instance",
      "/a.txt",
      "local",
      "c".repeat(64)
    );
    expect(workspace.hasUnsaved.value).toBe(false);
  });

  it("reloads a conflict without sending a write", async () => {
    await workspace.openFile("/a.txt");
    workspace.updateText("/a.txt", "local");
    vi.mocked(writeWorkspaceFile).mockResolvedValueOnce(snapshot("disk", "c".repeat(64), true));
    await workspace.saveFile();
    workspace.reloadConflict();
    expect(workspace.activeDocument.value?.text).toBe("disk");
    expect(workspace.hasUnsaved.value).toBe(false);
    expect(writeWorkspaceFile).toHaveBeenCalledTimes(1);
  });

  it("saves empty text and retains failed files when saving all", async () => {
    await workspace.openFile("/a.txt");
    workspace.updateText("/a.txt", "");
    await workspace.openFile("/b.txt");
    workspace.updateText("/b.txt", "other");
    vi.mocked(writeWorkspaceFile).mockRejectedValueOnce(new Error("offline"));
    expect(await workspace.saveAll()).toBe(false);
    expect(writeWorkspaceFile).toHaveBeenNthCalledWith(
      1,
      "node",
      "instance",
      "/a.txt",
      "",
      "a".repeat(64)
    );
    expect(workspace.documents.value[0].error).toBe("offline");
    expect(isDocumentDirty(workspace.documents.value[0])).toBe(true);
    expect(isDocumentDirty(workspace.documents.value[1])).toBe(false);
  });
});
