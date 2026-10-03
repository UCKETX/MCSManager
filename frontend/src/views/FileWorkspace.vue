<script setup lang="ts">
import Editor from "@/components/Editor.vue";
import { getFileConfigAddr } from "@/hooks/useFileManager";
import { useFileTree, type WorkspaceTreeNode } from "@/hooks/useFileTree";
import {
  isDocumentDirty,
  useFileWorkspace,
  workspacePath,
  type WorkspaceDocument
} from "@/hooks/useFileWorkspace";
import { useScreen } from "@/hooks/useScreen";
import { t } from "@/lang/i18n";
import {
  addFolder,
  deleteFile,
  downloadAddress,
  moveFile,
  touchFile
} from "@/services/apis/fileManager";
import { useAppConfigStore } from "@/stores/useAppConfigStore";
import { useAppToolsStore } from "@/stores/useAppToolsStore";
import { reportErrorMsg } from "@/tools/validator";
import { parseForwardAddress } from "@/tools/protocol";
import {
  ArrowLeftOutlined,
  CloseOutlined,
  CodeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileAddOutlined,
  FolderAddOutlined,
  FolderOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined
} from "@ant-design/icons-vue";
import { message, Modal } from "ant-design-vue";
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from "vue-router";

const MonacoEditor = defineAsyncComponent(() => import("@/components/MonacoEditor.vue"));
const MonacoDiffEditor = defineAsyncComponent(() => import("@/components/MonacoDiffEditor.vue"));
const route = useRoute();
const router = useRouter();
const queryString = (name: string) =>
  typeof route.query[name] === "string" ? (route.query[name] as string) : "";
const daemonId = queryString("daemonId");
const instanceId = queryString("instanceId");
const directory = queryString("directory") || "/";
const initialFile = queryString("file");
const { isPhone } = useScreen();
const { isDarkTheme } = useAppConfigStore();
const { openInputDialog } = useAppToolsStore();
const workspace = useFileWorkspace(daemonId, instanceId);
const {
  documents,
  activePath,
  activeDocument,
  hasUnsaved,
  busy,
  conflict,
  loadingPaths,
  savingAll,
  openFile,
  updateText,
  saveFile,
  saveAll,
  saveDocuments,
  removeDocument,
  reloadConflict
} = workspace;
const { nodes, loading, loadDirectory, findNode, refresh } = useFileTree(
  daemonId,
  instanceId,
  directory
);
const selectedKeys = ref<string[]>([]);
const expandedKeys = ref<string[]>([directory]);
const treeVersion = ref(0);
const selectedNode = computed(() => findNode(selectedKeys.value[0]) || nodes.value[0]);
const sidebarOpen = ref(true);
const sidebarWidth = ref(240);
const fullscreen = ref(false);
const container = ref<HTMLElement>();
const operationBusy = ref(false);
const quickOpen = ref(false);
const search = ref("");
const cursor = ref({ line: 1, column: 1, language: "plaintext", eol: "LF" });
const guard = ref<{ documents: WorkspaceDocument[]; resolve: (value: boolean) => void }>();
const guardSaving = ref(false);
const status = computed(() => {
  const document = activeDocument.value;
  if (!document) return t("TXT_CODE_WORKSPACE_READY");
  if (document.error) return document.error;
  if (document.saving) return t("TXT_CODE_WORKSPACE_SAVING");
  return t(isDocumentDirty(document) ? "TXT_CODE_WORKSPACE_UNSAVED" : "TXT_CODE_WORKSPACE_SAVED");
});

const collectFiles = (items: WorkspaceTreeNode[]): WorkspaceTreeNode[] =>
  items.flatMap((node) =>
    node.more ? [] : node.isLeaf ? [node] : collectFiles(node.children || [])
  );
const quickFiles = computed(() =>
  collectFiles(nodes.value)
    .filter((file) => file.key.toLowerCase().includes(search.value.toLowerCase()))
    .slice(0, 50)
);

const confirmUnsaved = async (items: WorkspaceDocument[]) => {
  if (savingAll.value || items.some((document) => document.saving)) {
    message.info(t("TXT_CODE_WORKSPACE_SAVING"));
    return false;
  }
  const dirty = items.filter(isDocumentDirty);
  if (!dirty.length) return true;
  if (guard.value || conflict.value) return false;
  return await new Promise<boolean>((resolve) => {
    guard.value = { documents: dirty, resolve };
  });
};

const answerGuard = async (answer: "save" | "discard" | "cancel") => {
  const request = guard.value;
  if (!request || guardSaving.value) return;
  if (answer === "save") {
    guardSaving.value = true;
    const success = await saveDocuments(request.documents);
    guardSaving.value = false;
    if (!success || request.documents.some(isDocumentDirty)) {
      guard.value = undefined;
      request.resolve(false);
      return;
    }
  }
  guard.value = undefined;
  request.resolve(answer !== "cancel");
};

const closeFile = async (document: WorkspaceDocument) => {
  if (await confirmUnsaved([document])) removeDocument(document.path);
};
const allowNavigation = async () => {
  if (operationBusy.value || guardSaving.value) return false;
  return await confirmUnsaved(documents.value);
};
onBeforeRouteLeave(allowNavigation);
onBeforeRouteUpdate(allowNavigation);

const returnToFiles = () => {
  const { file: _file, directory: _directory, ...query } = route.query;
  router.push({ path: "/instances/terminal/files", query });
};

const selectTree = async (keys: (string | number)[]) => {
  const node = findNode(String(keys[0] || ""));
  if (!node) return;
  if (node.more) {
    const parent = findNode(node.directory);
    if (parent) await loadDirectory(parent, true).catch(() => {});
    return;
  }
  selectedKeys.value = [node.key];
  if (node.isLeaf) {
    await openFile(node.key);
    if (isPhone.value) sidebarOpen.value = false;
  }
};

const refreshTree = async () => {
  await refresh().catch(() => {});
  treeVersion.value++;
  expandedKeys.value = [directory];
  selectedKeys.value = [];
};

const downloadEntry = async () => {
  const node = selectedNode.value;
  if (!node.isLeaf || node.more) return;
  try {
    const result = await downloadAddress().execute({
      params: { daemonId, uuid: instanceId, file_name: node.key }
    });
    if (!result.value) return;
    const address = parseForwardAddress(getFileConfigAddr(result.value), "http");
    const anchor = document.createElement("a");
    anchor.href = `${address}/download/${encodeURIComponent(
      result.value.password
    )}/${encodeURIComponent(node.title)}`;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  } catch (error: any) {
    reportErrorMsg(error.message);
  }
};

const validName = (name: string) =>
  name.length <= 255 && name !== "." && name !== ".." && !/[\\/\x00-\x1f<>:"|?*]/.test(name);
const requestName = async (title: string) => {
  const name = await openInputDialog(title).catch(() => undefined);
  if (name === undefined) return;
  if (!name || !validName(name)) {
    reportErrorMsg(t("TXT_CODE_WORKSPACE_INVALID_NAME"));
    return;
  }
  return name as string;
};
const createEntry = async (folder: boolean) => {
  if (operationBusy.value || savingAll.value) return;
  const parent = selectedNode.value.isLeaf
    ? selectedNode.value.key.slice(0, selectedNode.value.key.lastIndexOf("/")) || "/"
    : selectedNode.value.directory;
  const name = await requestName(t(folder ? "TXT_CODE_cfc657db" : "TXT_CODE_1e0b63b6"));
  if (!name) return;
  operationBusy.value = true;
  try {
    const target = workspacePath(parent, name);
    await (folder ? addFolder() : touchFile()).execute({
      params: { daemonId, uuid: instanceId },
      data: { target }
    });
    const parentNode = findNode(parent);
    if (parentNode) await loadDirectory(parentNode, false, true);
    if (!expandedKeys.value.includes(parent)) expandedKeys.value.push(parent);
    if (!folder) await openFile(target);
  } catch (error: any) {
    reportErrorMsg(error.message);
  } finally {
    operationBusy.value = false;
  }
};

const affectedDocuments = (path: string) =>
  documents.value.filter(
    (document) => document.path === path || document.path.startsWith(path.replace(/\/$/, "") + "/")
  );
const renameEntry = async () => {
  const node = selectedNode.value;
  if (node.key === directory || node.more || operationBusy.value) return;
  const name = await requestName(t("TXT_CODE_c83551f5"));
  if (!name || name === node.title) return;
  const affected = affectedDocuments(node.key);
  if (!(await confirmUnsaved(affected))) return;
  operationBusy.value = true;
  try {
    const parent = node.key.slice(0, node.key.lastIndexOf("/")) || "/";
    const target = workspacePath(parent, name);
    await moveFile().execute({
      params: { daemonId, uuid: instanceId },
      data: { targets: [[node.key, target]] }
    });
    for (const document of affected) removeDocument(document.path);
    await refreshTree();
    if (node.isLeaf) await openFile(target);
  } catch (error: any) {
    reportErrorMsg(error.message);
  } finally {
    operationBusy.value = false;
  }
};

const deleteEntry = () => {
  const node = selectedNode.value;
  if (node.key === directory || node.more || operationBusy.value || savingAll.value) return;
  Modal.confirm({
    title: t("TXT_CODE_WORKSPACE_DELETE_CONFIRM", { name: node.title }),
    okText: t("TXT_CODE_WORKSPACE_DELETE"),
    cancelText: t("TXT_CODE_WORKSPACE_CANCEL"),
    okButtonProps: { danger: true },
    onOk: async () => {
      const affected = affectedDocuments(node.key);
      if (savingAll.value || affected.some((document) => document.saving))
        throw new Error(t("TXT_CODE_WORKSPACE_SAVING"));
      if (affected.some(isDocumentDirty)) {
        reportErrorMsg(t("TXT_CODE_WORKSPACE_DELETE_DIRTY"));
        throw new Error(t("TXT_CODE_WORKSPACE_DELETE_DIRTY"));
      }
      operationBusy.value = true;
      try {
        await deleteFile().execute({
          params: { daemonId, uuid: instanceId },
          data: { targets: [node.key] }
        });
        for (const document of affected) removeDocument(document.path);
        await refreshTree();
      } catch (error: any) {
        reportErrorMsg(error.message);
        throw error;
      } finally {
        operationBusy.value = false;
      }
    }
  });
};

const handleKey = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    fullscreen.value = false;
    return;
  }
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    event.stopPropagation();
    if (guard.value || conflict.value || savingAll.value || operationBusy.value) return;
    if (event.shiftKey) void saveAll();
    else void saveFile();
  }
  if (event.key.toLowerCase() === "p") {
    event.preventDefault();
    quickOpen.value = true;
  }
};
const beforeUnload = (event: BeforeUnloadEvent) => {
  if (hasUnsaved.value || documents.value.some((document) => document.saving)) {
    event.preventDefault();
    event.returnValue = "";
  }
};
const cancelConflict = () => {
  if (!conflict.value?.document.saving) conflict.value = undefined;
};
const startResize = (event: PointerEvent) =>
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
const resize = (event: PointerEvent) => {
  if (!(event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId) || !container.value)
    return;
  sidebarWidth.value = Math.max(
    160,
    Math.min(
      container.value.clientWidth * 0.5,
      event.clientX - container.value.getBoundingClientRect().left - 44
    )
  );
};

onMounted(async () => {
  window.addEventListener("keydown", handleKey, true);
  window.addEventListener("beforeunload", beforeUnload);
  if (!daemonId || !instanceId) {
    reportErrorMsg(t("TXT_CODE_WORKSPACE_INVALID"));
    return;
  }
  await refreshTree();
  if (initialFile) await openFile(initialFile);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKey, true);
  window.removeEventListener("beforeunload", beforeUnload);
  guard.value?.resolve(false);
});
</script>

<template>
  <section
    ref="container"
    class="file-workspace"
    :class="{ dark: isDarkTheme, fullscreen }"
    :style="{ '--sidebar-width': sidebarWidth + 'px' }"
  >
    <header class="workspace-toolbar">
      <a-button type="text" size="small" @click="returnToFiles">
        <ArrowLeftOutlined />{{ t("TXT_CODE_WORKSPACE_BACK") }}
      </a-button>
      <div class="workspace-heading">
        <CodeOutlined /><span>{{ t("TXT_CODE_WORKSPACE_TITLE") }}</span><span class="workspace-instance">{{ instanceId.slice(0, 8) }}</span>
      </div>
      <div class="toolbar-actions">
        <a-button
          size="small"
          :disabled="!activeDocument || activeDocument.saving || savingAll || operationBusy"
          :loading="activeDocument?.saving"
          @click="() => saveFile()"
        >
          <SaveOutlined />{{ t("TXT_CODE_WORKSPACE_SAVE") }}
        </a-button>
        <a-button size="small" :disabled="!hasUnsaved || busy || operationBusy" @click="saveAll">
          {{ t("TXT_CODE_WORKSPACE_SAVE_ALL") }}
        </a-button>
        <a-button
          type="text"
          size="small"
          :aria-label="t('TXT_CODE_WORKSPACE_FULLSCREEN')"
          @click="fullscreen = !fullscreen"
        >
          <FullscreenExitOutlined v-if="fullscreen" /><FullscreenOutlined v-else />
        </a-button>
      </div>
    </header>
    <div class="workspace-body">
      <nav class="activity-bar" :aria-label="t('TXT_CODE_WORKSPACE_EXPLORER')">
        <button
          :aria-label="t('TXT_CODE_WORKSPACE_EXPLORER')"
          :aria-pressed="sidebarOpen"
          @click="sidebarOpen = !sidebarOpen"
        >
          <FolderOutlined />
        </button>
        <button :aria-label="t('TXT_CODE_WORKSPACE_QUICK_OPEN')" @click="quickOpen = true">
          <SearchOutlined />
        </button>
      </nav>
      <aside v-show="sidebarOpen" class="workspace-sidebar">
        <div class="explorer-heading">{{ t("TXT_CODE_WORKSPACE_EXPLORER") }}</div>
        <div class="explorer-actions">
          <a-button
            type="text"
            size="small"
            :disabled="operationBusy || savingAll"
            :aria-label="t('TXT_CODE_1e0b63b6')"
            @click="createEntry(false)"
          >
            <FileAddOutlined />
          </a-button>
          <a-button
            type="text"
            size="small"
            :disabled="operationBusy || savingAll"
            :aria-label="t('TXT_CODE_cfc657db')"
            @click="createEntry(true)"
          >
            <FolderAddOutlined />
          </a-button>
          <a-button
            type="text"
            size="small"
            :disabled="loading"
            :aria-label="t('TXT_CODE_a53573af')"
            @click="refreshTree"
          >
            <ReloadOutlined :spin="loading" />
          </a-button>
          <a-button
            type="text"
            size="small"
            :disabled="selectedNode.key === directory || operationBusy || savingAll"
            :aria-label="t('TXT_CODE_c83551f5')"
            @click="renameEntry"
          >
            <EditOutlined />
          </a-button>
          <a-button
            type="text"
            size="small"
            :disabled="selectedNode.key === directory || operationBusy || savingAll"
            :aria-label="t('TXT_CODE_WORKSPACE_DELETE')"
            @click="deleteEntry"
          >
            <DeleteOutlined />
          </a-button>
          <a-button
            type="text"
            size="small"
            :disabled="!selectedNode.isLeaf || selectedNode.more"
            :aria-label="t('TXT_CODE_65b21404')"
            @click="downloadEntry"
          >
            <DownloadOutlined />
          </a-button>
        </div>
        <div class="tree-scroll">
          <a-directory-tree
            :key="treeVersion"
            v-model:expanded-keys="expandedKeys"
            :selected-keys="selectedKeys"
            :tree-data="nodes"
            :load-data="(node: any) => loadDirectory(node.dataRef).catch(() => {})"
            :show-icon="true"
            @select="selectTree"
          />
        </div>
      </aside>
      <div
        v-if="sidebarOpen && !isPhone"
        class="sidebar-resizer"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        :aria-valuenow="sidebarWidth"
        :aria-label="t('TXT_CODE_WORKSPACE_RESIZE')"
        @pointerdown="startResize"
        @pointermove="resize"
        @keydown.left.prevent="sidebarWidth = Math.max(160, sidebarWidth - 20)"
        @keydown.right.prevent="sidebarWidth = Math.min(480, sidebarWidth + 20)"
      />
      <main class="workspace-editor" :inert="operationBusy ? true : undefined">
        <div class="document-tabs" role="tablist" :aria-label="t('TXT_CODE_WORKSPACE_OPEN_FILES')">
          <div
            v-for="document in documents"
            :key="document.path"
            class="document-tab"
            :class="{ active: activePath === document.path }"
          >
            <button
              role="tab"
              :aria-selected="activePath === document.path"
              :title="document.path"
              @click="openFile(document.path)"
            >
              <span>{{ document.name }}</span><span
                v-if="isDocumentDirty(document)"
                class="dirty-dot"
                :aria-label="t('TXT_CODE_WORKSPACE_UNSAVED')"
              >●</span>
            </button>
            <button
              class="close-tab"
              :disabled="document.saving || savingAll"
              :aria-label="t('TXT_CODE_WORKSPACE_CLOSE_FILE', { name: document.name })"
              @click="closeFile(document)"
            >
              <CloseOutlined />
            </button>
          </div>
        </div>
        <div v-if="activeDocument" class="editor-breadcrumb" :title="activeDocument.path">
          {{ activeDocument.path }}
        </div>
        <div class="editor-surface">
          <template v-if="activeDocument">
            <Editor
              v-if="isPhone"
              :key="activeDocument.path + activeDocument.revision"
              :text="activeDocument.text"
              :filename="activeDocument.name"
              height="100%"
              @update:text="(text: string) => updateText(activeDocument!.path, text)"
            />
            <MonacoEditor
              v-else
              :documents="documents"
              :active-path="activePath"
              :dark="isDarkTheme"
              @change="updateText"
              @save="() => saveFile()"
              @cursor="(line, column, language, eol) => (cursor = { line, column, language, eol })"
            />
          </template>
          <div v-else class="workspace-empty">
            <CodeOutlined />
            <h2>{{ t("TXT_CODE_WORKSPACE_TITLE") }}</h2>
            <p>{{ t("TXT_CODE_WORKSPACE_EMPTY") }}</p>
            <span>Ctrl / ⌘ + S · {{ t("TXT_CODE_WORKSPACE_SAVE") }}</span>
          </div>
          <div v-if="loadingPaths.size" class="loading-file" role="status">
            {{ t("TXT_CODE_WORKSPACE_LOADING") }}
          </div>
        </div>
      </main>
    </div>
    <footer class="workspace-status">
      <span role="status" :class="{ 'status-error': activeDocument?.error }">{{ status }}</span>
      <div v-if="activeDocument">
        <span v-if="!isPhone">{{
          t("TXT_CODE_WORKSPACE_POSITION", { line: cursor.line, column: cursor.column })
        }}</span><span>{{ activeDocument.encoding }}</span><span v-if="!isPhone">{{ cursor.eol }}</span><span v-if="!isPhone">{{ cursor.language }}</span>
      </div>
    </footer>
  </section>

  <a-modal
    :open="Boolean(guard)"
    :title="t('TXT_CODE_WORKSPACE_UNSAVED')"
    :closable="!guardSaving"
    :mask-closable="false"
    @cancel="answerGuard('cancel')"
  >
    <p>{{ t("TXT_CODE_WORKSPACE_LEAVE_CONFIRM") }}</p>
    <ul>
      <li v-for="document in guard?.documents" :key="document.path">{{ document.path }}</li>
    </ul>
    <template #footer>
      <a-button :disabled="guardSaving" @click="answerGuard('cancel')">
        {{ t("TXT_CODE_WORKSPACE_CANCEL") }}
      </a-button><a-button danger :disabled="guardSaving" @click="answerGuard('discard')">
        {{ t("TXT_CODE_WORKSPACE_DISCARD") }}
      </a-button><a-button type="primary" :loading="guardSaving" @click="answerGuard('save')">
        {{ t("TXT_CODE_WORKSPACE_SAVE") }}
      </a-button>
    </template>
  </a-modal>

  <a-modal
    :open="Boolean(conflict)"
    :title="t('TXT_CODE_WORKSPACE_CONFLICT')"
    width="1100px"
    :mask-closable="false"
    :closable="!conflict?.document.saving"
    @cancel="cancelConflict"
  >
    <template v-if="conflict">
      <p>{{ t("TXT_CODE_WORKSPACE_CONFLICT_HELP") }}</p>
      <div class="diff-labels">
        <span>{{ t("TXT_CODE_WORKSPACE_DISK_VERSION") }}</span><span>{{ t("TXT_CODE_WORKSPACE_LOCAL_VERSION") }}</span>
      </div>
      <MonacoDiffEditor
        v-if="!isPhone"
        :original="conflict.remote.text"
        :modified="conflict.document.text"
        :filename="conflict.document.name"
        :dark="isDarkTheme"
      />
      <pre v-else>{{ conflict.remote.text }}</pre>
    </template>
    <template #footer>
      <a-button :disabled="conflict?.document.saving" @click="cancelConflict">
        {{ t("TXT_CODE_WORKSPACE_CANCEL") }}
      </a-button><a-button :disabled="conflict?.document.saving" @click="reloadConflict">
        {{ t("TXT_CODE_WORKSPACE_RELOAD") }}
      </a-button><a-button
        danger
        :loading="conflict?.document.saving"
        @click="conflict && saveFile(conflict.document, conflict.remote.revision)"
      >
        {{ t("TXT_CODE_WORKSPACE_OVERWRITE") }}
      </a-button>
    </template>
  </a-modal>

  <a-modal v-model:open="quickOpen" :title="t('TXT_CODE_WORKSPACE_QUICK_OPEN')" :footer="null">
    <a-input
      v-model:value="search"
      :placeholder="t('TXT_CODE_WORKSPACE_SEARCH_FILES')"
      allow-clear
    />
    <div class="quick-files">
      <button
        v-for="file in quickFiles"
        :key="file.key"
        @click="
          openFile(file.key);
          quickOpen = false;
        "
      >
        {{ file.key }}
      </button><a-empty v-if="!quickFiles.length" />
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.file-workspace {
  --ws-bg: #fff;
  --ws-side: #f4f5f7;
  --ws-tabs: #eceef1;
  --ws-text: #283142;
  --ws-muted: #667085;
  --ws-border: #dfe3e8;
  --ws-accent: #1677ff;
  display: flex;
  flex-direction: column;
  height: calc(100svh - 180px);
  min-height: 520px;
  background: var(--ws-bg);
  color: var(--ws-text);
  border: 1px solid var(--ws-border);
  border-radius: 8px;
  overflow: hidden;
  &.dark {
    --ws-bg: #1e1e1e;
    --ws-side: #252526;
    --ws-tabs: #2d2d2d;
    --ws-text: #ddd;
    --ws-muted: #a7a7aa;
    --ws-border: #383838;
  }
  &.fullscreen {
    position: fixed;
    inset: 0;
    z-index: 999;
    height: 100svh;
    min-height: 0;
    border-radius: 0;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
    opacity: 0.5;
  }
}
.workspace-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ws-border);
}
.workspace-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.workspace-instance {
  font-size: 12px;
  color: var(--ws-muted);
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.workspace-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.activity-bar {
  width: 44px;
  flex-shrink: 0;
  background: var(--ws-tabs);
  border-right: 1px solid var(--ws-border);
  display: flex;
  flex-direction: column;
  button {
    color: var(--ws-muted);
    border: 0;
    background: transparent;
    min-height: 44px;
    font-size: 20px;
  }
  button[aria-pressed="true"] {
    color: var(--ws-accent);
    border-left: 2px solid var(--ws-accent);
  }
}
.workspace-sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  background: var(--ws-side);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.explorer-heading {
  padding: 13px 14px 6px;
  font-size: 12px;
  font-weight: 500;
}
.explorer-actions {
  display: flex;
  flex-wrap: wrap;
  padding: 0 6px 8px;
}
.tree-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 4px 16px;
  :deep(.ant-tree) {
    width: max-content;
    min-width: 100%;
    background: transparent;
    color: var(--ws-text);
  }
  :deep(.ant-tree-node-content-wrapper) {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    flex-shrink: 0;
  }
  :deep(.ant-tree-iconEle) {
    flex-shrink: 0;
  }
}
.sidebar-resizer {
  width: 4px;
  flex-shrink: 0;
  background: var(--ws-border);
  cursor: col-resize;
  touch-action: none;
  &:hover {
    background: var(--ws-accent);
  }
}
.workspace-editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.document-tabs {
  display: flex;
  overflow-x: auto;
  flex-shrink: 0;
  min-height: 38px;
  background: var(--ws-tabs);
}
.document-tab {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border-right: 1px solid var(--ws-border);
  border-top: 2px solid transparent;
  padding: 0 4px;
  &.active {
    background: var(--ws-bg);
    border-top-color: var(--ws-accent);
  }
  button {
    color: var(--ws-text);
    background: transparent;
    border: 0;
    padding: 9px 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .close-tab {
    padding: 8px 5px;
    font-size: 11px;
  }
}
.dirty-dot {
  font-size: 10px;
  color: var(--ws-accent);
}
.editor-breadcrumb {
  padding: 6px 14px;
  font-size: 12px;
  color: var(--ws-muted);
  border-bottom: 1px solid var(--ws-border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editor-surface {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.workspace-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  color: var(--ws-muted);
  > .anticon {
    font-size: 52px;
    opacity: 0.4;
    margin-bottom: 16px;
  }
  h2 {
    color: var(--ws-text);
    font-size: 20px;
  }
  span {
    font-size: 12px;
  }
}
.loading-file {
  position: absolute;
  top: 8px;
  right: 16px;
  padding: 6px 12px;
  background: var(--ws-side);
  border: 1px solid var(--ws-border);
  border-radius: 4px;
}
.workspace-status {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  font-size: 12px;
  background: var(--ws-accent);
  color: #fff;
  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  > div {
    display: flex;
    gap: 16px;
  }
  .status-error {
    font-weight: 600;
  }
}
.diff-labels {
  display: flex;
  justify-content: space-around;
  margin-bottom: 8px;
}
.quick-files {
  max-height: 360px;
  overflow: auto;
  margin-top: 12px;
  button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 10px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    overflow-wrap: anywhere;
    &:hover {
      background: rgba(128, 128, 128, 0.1);
    }
  }
}
@media (max-width: 992px) {
  .file-workspace {
    height: calc(100svh - 160px);
    min-height: 400px;
  }
  .workspace-heading {
    display: none;
  }
  .workspace-toolbar {
    gap: 4px;
    padding: 8px 4px;
  }
  .toolbar-actions {
    gap: 4px;
  }
  .workspace-body {
    position: relative;
  }
  .workspace-sidebar {
    position: absolute;
    left: 44px;
    top: 0;
    bottom: 0;
    z-index: 2;
    width: min(280px, calc(100% - 44px));
    box-shadow: 4px 0 10px rgba(0, 0, 0, 0.1);
  }
  .document-tab button {
    min-height: 40px;
  }
}
</style>
