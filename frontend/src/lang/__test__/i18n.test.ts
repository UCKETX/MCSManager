// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { initI18n, t } from "../i18n";

vi.mock("@/stores/useAppStateStore", () => ({ useAppStateStore: () => ({ state: { isInstall: true } }) }));
vi.mock("@/services/apis", () => ({ updateSettings: vi.fn() }));

describe("installed application language fallback", () => {
  it("loads English for new workspace keys absent from the selected translation", async () => {
    await initI18n("ja_jp");
    expect(t("TXT_CODE_WORKSPACE_TITLE")).toBe("Code workspace");
  });
});
