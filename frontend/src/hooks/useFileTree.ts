import { t } from "@/lang/i18n";
import { fileList } from "@/services/apis/fileManager";
import { reportErrorMsg } from "@/tools/validator";
import { onBeforeUnmount, ref } from "vue";
import { workspacePath } from "./useFileWorkspace";

export interface WorkspaceTreeNode {
  key: string;
  title: string;
  isLeaf: boolean;
  directory: string;
  size?: number;
  more?: boolean;
  nextPage?: number;
  children?: WorkspaceTreeNode[];
}

export function useFileTree(daemonId: string, instanceId: string, directory: string) {
  const nodes = ref<WorkspaceTreeNode[]>([
    { key: directory, title: directory, isLeaf: false, directory }
  ]);
  const loading = ref(false);
  const pending = new Set<string>();
  let generation = 0;
  onBeforeUnmount(() => {
    generation++;
  });

  const loadDirectory = async (node: WorkspaceTreeNode, append = false, reload = false) => {
    if (node.isLeaf || node.more) return;
    if (node.children !== undefined && !append && !reload) return;
    if (pending.has(node.key)) return;
    pending.add(node.key);
    loading.value = true;
    const currentGeneration = generation;
    try {
      const { execute } = fileList();
      const response = await execute({
        params: {
          daemonId,
          uuid: instanceId,
          target: node.directory,
          page: append ? node.nextPage || 0 : 0,
          page_size: 100,
          file_name: ""
        },
        forceRequest: true
      });
      if (generation !== currentGeneration || !response.value) return;
      const data = response.value;
      const children = data.items.map((item) => ({
        key: workspacePath(node.directory, item.name),
        title: item.name,
        directory: workspacePath(node.directory, item.name),
        isLeaf: item.type !== 0,
        size: item.size
      }));
      const existing = append ? (node.children || []).filter((child) => !child.more) : [];
      const nextPage = (append ? node.nextPage || 0 : 0) + 1;
      const newChildren = [...existing, ...children];
      if (nextPage * data.pageSize < data.total) {
        newChildren.push({
          key: `${node.key}/\0more`,
          title: t("TXT_CODE_WORKSPACE_LOAD_MORE"),
          isLeaf: true,
          directory: node.directory,
          more: true
        });
      }
      // Ant Tree derives key entities from the top-level data reference.
      // Replace ancestors together so its flattening and entity maps stay in sync.
      const replace = (items: WorkspaceTreeNode[]): WorkspaceTreeNode[] =>
        items.map((item) => {
          if (item.key === node.key) return { ...item, children: newChildren, nextPage };
          return item.children ? { ...item, children: replace(item.children) } : item;
        });
      nodes.value = replace(nodes.value);
    } catch (error: any) {
      if (generation === currentGeneration) reportErrorMsg(error.message);
      throw error;
    } finally {
      pending.delete(node.key);
      loading.value = pending.size > 0;
    }
  };

  const findNode = (key: string, items = nodes.value): WorkspaceTreeNode | undefined => {
    for (const node of items) {
      if (node.key === key) return node;
      const found = node.children && findNode(key, node.children);
      if (found) return found;
    }
  };

  const refresh = async () => {
    if (loading.value) return;
    generation++;
    await loadDirectory(nodes.value[0], false, true);
  };

  return { nodes, loading, loadDirectory, findNode, refresh };
}
