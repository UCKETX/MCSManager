import { $t } from "../i18n";

// Bound the lock set to active operations; reject contention instead of queuing requests.
const activeEdits = new Set<string>();

export async function withFileEditLock<T>(path: string, action: () => Promise<T>): Promise<T> {
  if (activeEdits.has(path)) throw new Error($t("TXT_CODE_WORKSPACE_BUSY"));
  activeEdits.add(path);
  try {
    return await action();
  } finally {
    activeEdits.delete(path);
  }
}
