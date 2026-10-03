import { t } from "@/lang/i18n";
import {
  readWorkspaceFile,
  writeWorkspaceFile,
  type FileContentSnapshot
} from "@/services/apis/fileManager";
import { reportErrorMsg } from "@/tools/validator";
import { computed, onBeforeUnmount, reactive, ref } from "vue";

export interface WorkspaceDocument {
  path: string;
  name: string;
  text: string;
  savedText: string;
  revision: string;
  encoding: string;
  saving: boolean;
  error: string;
}

export const workspacePath = (directory: string, name: string) =>
  `${directory.replace(/[\\/]+$/, "")}/${name}`;

export const isDocumentDirty = (document: WorkspaceDocument) =>
  document.text !== document.savedText;

export function useFileWorkspace(daemonId: string, instanceId: string) {
  const documents = ref<WorkspaceDocument[]>([]);
  const activePath = ref("");
  const loadingPaths = reactive(new Set<string>());
  const savingAll = ref(false);
  const conflict = ref<{ document: WorkspaceDocument; remote: FileContentSnapshot }>();
  const activeDocument = computed(() => documents.value.find((d) => d.path === activePath.value));
  const hasUnsaved = computed(() => documents.value.some(isDocumentDirty));
  const busy = computed(
    () => savingAll.value || loadingPaths.size > 0 || documents.value.some((d) => d.saving)
  );
  let disposed = false;
  let requestedPath = "";
  onBeforeUnmount(() => {
    disposed = true;
  });

  const openFile = async (path: string) => {
    if (documents.value.some((d) => d.path === path)) {
      requestedPath = path;
      activePath.value = path;
      return;
    }
    if (loadingPaths.has(path)) {
      requestedPath = path;
      return;
    }
    if (documents.value.length + loadingPaths.size >= 20) {
      reportErrorMsg(t("TXT_CODE_WORKSPACE_TAB_LIMIT"));
      return;
    }
    requestedPath = path;
    loadingPaths.add(path);
    try {
      const snapshot = await readWorkspaceFile(daemonId, instanceId, path);
      if (disposed) return;
      // Include pending responses in the check by evaluating the live document set.
      const size = documents.value.reduce((sum, d) => sum + d.text.length, snapshot.text.length);
      if (size > 20 * 1024 * 1024) throw new Error(t("TXT_CODE_WORKSPACE_TAB_LIMIT"));
      documents.value.push({
        path,
        name: path.split(/[\\/]/).pop() || path,
        text: snapshot.text,
        savedText: snapshot.text,
        revision: snapshot.revision,
        encoding: snapshot.encoding,
        saving: false,
        error: ""
      });
      if (requestedPath === path) activePath.value = path;
    } catch (error: any) {
      if (!disposed) reportErrorMsg(error.message);
    } finally {
      loadingPaths.delete(path);
    }
  };

  const updateText = (path: string, text: string) => {
    const document = documents.value.find((d) => d.path === path);
    if (document) document.text = text;
  };

  const saveFile = async (document = activeDocument.value, revision?: string) => {
    if (!document || document.saving) return false;
    if (!isDocumentDirty(document) && revision === undefined) return true;
    const submittedText = document.text;
    document.saving = true;
    document.error = "";
    try {
      const result = await writeWorkspaceFile(
        daemonId,
        instanceId,
        document.path,
        submittedText,
        revision ?? document.revision
      );
      if (disposed) return false;
      if (result.conflict) {
        conflict.value = { document, remote: result };
        activePath.value = document.path;
        return false;
      }
      document.savedText = submittedText;
      document.revision = result.revision;
      conflict.value = undefined;
      return true;
    } catch (error: any) {
      document.error = error.message;
      if (!disposed) reportErrorMsg(error.message);
      return false;
    } finally {
      document.saving = false;
    }
  };

  const saveDocuments = async (items: WorkspaceDocument[]) => {
    if (savingAll.value) return false;
    savingAll.value = true;
    try {
      let success = true;
      for (const document of [...items]) {
        if (disposed) return false;
        if (!isDocumentDirty(document)) continue;
        if (!(await saveFile(document))) success = false;
        // Resolve conflicts one at a time; never replace an open comparison.
        if (conflict.value) break;
        // Normal users share an eight-requests-per-second panel limit.
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return success && !items.some(isDocumentDirty);
    } finally {
      savingAll.value = false;
    }
  };

  const saveAll = () => saveDocuments(documents.value);

  const removeDocument = (path: string) => {
    const index = documents.value.findIndex((d) => d.path === path);
    if (index < 0) return;
    documents.value.splice(index, 1);
    if (activePath.value === path)
      activePath.value = documents.value[Math.min(index, documents.value.length - 1)]?.path || "";
  };

  const reloadConflict = () => {
    if (!conflict.value) return;
    const { document, remote } = conflict.value;
    document.text = document.savedText = remote.text;
    document.revision = remote.revision;
    document.encoding = remote.encoding;
    document.error = "";
    conflict.value = undefined;
  };

  return {
    documents,
    activePath,
    activeDocument,
    hasUnsaved,
    busy,
    loadingPaths,
    savingAll,
    conflict,
    openFile,
    updateText,
    saveFile,
    saveAll,
    saveDocuments,
    removeDocument,
    reloadConflict
  };
}
