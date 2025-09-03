<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue';
import { FolderOutlined, FolderOpenOutlined, FileOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { useVSCodeStore, type FileTreeNode } from '@/stores/useVSCodeStore';
import { fileList, fileContent, touchFile, addFolder, deleteFile } from '@/services/apis/fileManager';
import FileTreeNodeComponent from './FileTreeNode.vue';

interface Props {
  daemonId: string;
  instanceUuid: string;
}

const props = defineProps<Props>();

const vscodeStore = useVSCodeStore();
const isLoading = ref(false);
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const selectedNode = ref<FileTreeNode | null>(null);
const newItemName = ref('');
const newItemType = ref<'file' | 'folder'>('file');
const showNewItemModal = ref(false);

// 计算文件树数据
const fileTreeData = computed(() => vscodeStore.fileTree);

// 获取文件图标
const getFileIcon = (node: FileTreeNode) => {
  if (node.type === 'directory') {
    return node.isExpanded ? FolderOpenOutlined : FolderOutlined;
  }
  return FileOutlined;
};

// 获取文件类型样式类
const getFileTypeClass = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    'js': 'file-js',
    'jsx': 'file-js',
    'ts': 'file-ts',
    'tsx': 'file-ts',
    'vue': 'file-vue',
    'py': 'file-python',
    'json': 'file-json',
    'html': 'file-html',
    'css': 'file-css',
    'scss': 'file-css',
    'less': 'file-css',
    'md': 'file-markdown',
    'yml': 'file-yaml',
    'yaml': 'file-yaml',
    'xml': 'file-xml',
    'sql': 'file-sql',
    'sh': 'file-shell',
    'dockerfile': 'file-docker',
    'gitignore': 'file-git',
    'env': 'file-env'
  };
  
  return typeMap[ext || ''] || 'file-default';
};

// 加载文件树
const loadFileTree = async (path: string = '.') => {
  if (!props.daemonId || !props.instanceUuid) {
    console.error('Missing required parameters:', { daemonId: props.daemonId, instanceUuid: props.instanceUuid });
    message.error('缺少必要参数：daemonId 或 instanceUuid');
    return;
  }
  
  // 验证路径格式
  if (!path || typeof path !== 'string') {
    console.error('Invalid path for loadFileTree:', path);
    message.error('无效的路径');
    return;
  }
  
  isLoading.value = true;
  try {
    console.log('Loading file tree with params:', {
      daemonId: props.daemonId,
      uuid: props.instanceUuid,
      target: path,
      page: 0,
      page_size: 100,
      file_name: ''
    });
    
    const { execute } = fileList();
    const response = await execute({
      params: {
        daemonId: props.daemonId,
        uuid: props.instanceUuid,
        target: path,
        page: 0,
        page_size: 100,
        file_name: ''
      }
    });
    
    console.log('API response:', response);
    
    if (response.value && response.value.items) {
      console.log('Raw API items:', response.value.items);
      
      const nodes: FileTreeNode[] = response.value.items.map((item: any) => {
        console.log('Processing item:', item, 'type:', item.type, 'isFile:', item.type === 1);
        
        const nodeType = item.type === 1 ? 'file' : 'directory';
        const nodePath = item.path || `${path === '.' ? '' : path}/${item.name}`;
        
        return {
          name: item.name,
          path: nodePath,
          type: nodeType,
          size: item.size || 0,
          time: item.time || Date.now(),
          mode: item.mode || '',
          isExpanded: false,
          children: nodeType === 'directory' ? [] : undefined
        };
      });
      
      // 排序：文件夹在前，文件在后，按名称排序
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      
      if (path === '.') {
        vscodeStore.setFileTree(nodes);
      } else {
        // 更新特定路径的子节点
        updateNodeChildren(vscodeStore.fileTree, path, nodes);
      }
      
      console.log('File tree loaded successfully:', nodes.length, 'items');
    } else {
      console.warn('No items in API response:', response);
      message.warning('未找到文件或文件夹');
    }
  } catch (error: any) {
    console.error('Failed to load file tree:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config
    });
    
    // 提供更详细的错误信息
    let errorMessage = '加载文件树失败';
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 400) {
        errorMessage = '请求参数错误，请检查 daemonId 和 instanceId 是否正确';
      } else if (status === 404) {
        errorMessage = '实例不存在或守护进程未连接';
      } else if (status === 500) {
        errorMessage = '服务器内部错误';
      } else {
        errorMessage = `请求失败 (${status}): ${data?.message || error.message}`;
      }
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage = '网络连接错误，请检查服务器是否运行';
    } else if (error.message) {
      // 处理文件系统错误
      if (error.message.includes('ENOTDIR')) {
        errorMessage = `路径错误：${path} 不是一个目录`;
      } else if (error.message.includes('ENOENT')) {
        errorMessage = `路径不存在：${path}`;
      } else if (error.message.includes('EACCES')) {
        errorMessage = `权限不足：无法访问 ${path}`;
      } else {
        errorMessage = `错误: ${error.message}`;
      }
    } else {
      errorMessage = '未知错误';
    }
    
    message.error(errorMessage);
  } finally {
    isLoading.value = false;
  }
};

// 根据文件名获取语言类型
const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const languageMap: { [key: string]: string } = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'vue': 'vue',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'php': 'php',
    'go': 'go',
    'rs': 'rust',
    'sh': 'shell',
    'yml': 'yaml',
    'yaml': 'yaml',
    'xml': 'xml',
    'sql': 'sql'
  };
  return languageMap[ext || ''] || 'plaintext';
};

// 更新节点的子节点
const updateNodeChildren = (nodes: FileTreeNode[], targetPath: string, children: FileTreeNode[]) => {
  for (const node of nodes) {
    if (node.path === targetPath && node.type === 'directory') {
      node.children = children;
      node.isExpanded = true;
      break;
    }
    if (node.children) {
      updateNodeChildren(node.children, targetPath, children);
    }
  }
};

// 切换文件夹展开/折叠
const toggleFolder = async (node: FileTreeNode) => {
  // 确保只对目录执行展开/折叠操作
  if (node.type !== 'directory') {
    console.warn('Attempted to toggle non-directory item:', node);
    message.error(`无法展开：${node.name} 不是目录`);
    return;
  }
  
  if (node.isExpanded) {
    // 折叠文件夹
    node.isExpanded = false;
    node.children = [];
  } else {
    // 展开文件夹
    if (!node.children || node.children.length === 0) {
      await loadFileTree(node.path);
    } else {
      node.isExpanded = true;
    }
  }
};

// 选择文件
const selectFile = async (node: FileTreeNode) => {
  // 如果是目录，切换展开/折叠状态
  if (node.type === 'directory') {
    await toggleFolder(node);
    return;
  }
  
  // 确保只对文件执行读取操作
  if (node.type !== 'file') {
    console.warn('Attempted to open non-file item:', node);
    message.warning(`无法打开：${node.name} 不是文件`);
    return;
  }
  
  try {
    // 检查文件是否已经打开
    const existingTab = vscodeStore.fileTabs.find(tab => tab.path === node.path);
    if (existingTab) {
      vscodeStore.switchToTab(existingTab.id);
      return;
    }
    
    // 获取文件内容
    const { execute } = fileContent();
    const response = await execute({
      params: {
        daemonId: props.daemonId,
        uuid: props.instanceUuid
      },
      data: {
        target: node.path
      }
    });
    
    if (response.value) {
      // 打开新标签页
      const content = typeof response.value === 'string' ? response.value : '';
      const language = getLanguageFromFileName(node.name);
      vscodeStore.openFile(node.path, node.name, content, language);
    }
  } catch (error: any) {
    console.error('Failed to open file:', error);
    
    // 提供更详细的错误信息
    let errorMessage = `打开文件失败: ${node.name}`;
    if (error.message && error.message.includes('EISDIR')) {
      errorMessage = `无法打开：${node.name} 是一个目录，不是文件`;
    } else if (error.message && error.message.includes('ENOENT')) {
      errorMessage = `文件不存在：${node.name}`;
    } else if (error.message && error.message.includes('EACCES')) {
      errorMessage = `权限不足：无法访问 ${node.name}`;
    }
    
    message.error(errorMessage);
  }
};

// 显示右键菜单
const showContextMenu = (event: MouseEvent, node: FileTreeNode) => {
  event.preventDefault();
  event.stopPropagation();
  
  selectedNode.value = node;
  contextMenuPosition.value = { x: event.clientX, y: event.clientY };
  contextMenuVisible.value = true;
  
  // 点击其他地方隐藏菜单
  const hideMenu = () => {
    contextMenuVisible.value = false;
    document.removeEventListener('click', hideMenu);
  };
  
  setTimeout(() => {
    document.addEventListener('click', hideMenu);
  }, 0);
};

// 创建新文件/文件夹
const showCreateModal = (type: 'file' | 'folder') => {
  newItemType.value = type;
  newItemName.value = '';
  showNewItemModal.value = true;
  contextMenuVisible.value = false;
};

// 确认创建新项目
const confirmCreate = async () => {
  if (!newItemName.value.trim()) {
    message.error('请输入名称');
    return;
  }
  
  try {
    const targetPath = selectedNode.value?.type === 'directory' 
      ? `${selectedNode.value.path}/${newItemName.value}`
      : newItemName.value;
    
    if (newItemType.value === 'file') {
      // 创建文件
      const { execute } = touchFile();
      await execute({
        params: {
          daemonId: props.daemonId,
          uuid: props.instanceUuid
        },
        data: {
          target: targetPath
        }
      });
    } else {
      // 创建文件夹
      const { execute } = addFolder();
      await execute({
        params: {
          daemonId: props.daemonId,
          uuid: props.instanceUuid
        },
        data: {
          target: targetPath
        }
      });
    }
    
    message.success(`${newItemType.value === 'file' ? '文件' : '文件夹'}创建成功`);
    
    // 刷新文件树
    if (selectedNode.value?.type === 'directory') {
      await loadFileTree(selectedNode.value.path);
    } else {
      await loadFileTree('.');
    }
    
    showNewItemModal.value = false;
  } catch (error) {
    console.error('Failed to create item:', error);
    message.error('创建失败');
  }
};

// 删除文件/文件夹
const deleteItem = async () => {
  if (!selectedNode.value) return;
  
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除 "${selectedNode.value.name}" 吗？此操作不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        const { execute } = deleteFile();
        await execute({
          params: {
            daemonId: props.daemonId,
            uuid: props.instanceUuid
          },
          data: {
            targets: [selectedNode.value!.path]
          }
        });
        
        message.success('删除成功');
        
        // 如果删除的文件已打开，关闭对应标签页
        if (selectedNode.value!.type === 'file') {
          const tab = vscodeStore.fileTabs.find(t => t.path === selectedNode.value!.path);
          if (tab) {
            vscodeStore.closeFile(tab.id);
          }
        }
        
        // 刷新文件树
        await loadFileTree('.');
        
        contextMenuVisible.value = false;
      } catch (error) {
        console.error('Failed to delete item:', error);
        message.error('删除失败');
      }
    }
  });
};

// 刷新文件树
const refreshFileTree = async () => {
  await loadFileTree('.');
  message.success('文件树已刷新');
};

// 组件挂载时加载文件树
onMounted(() => {
  // 参数验证
  if (!props.daemonId || !props.instanceUuid) {
    console.error('FileTreePanel: Missing required parameters', {
      daemonId: props.daemonId,
      instanceUuid: props.instanceUuid
    });
    message.error('缺少必需的参数，无法加载文件树');
    return;
  }
  
  loadFileTree('.');
});
</script>

<template>
  <div class="file-tree-panel">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="title">文件资源管理器</div>
      <div class="actions">
        <a-button 
          type="text" 
          size="small" 
          :icon="h(ReloadOutlined)" 
          @click="refreshFileTree"
          :loading="isLoading"
          title="刷新"
        />
      </div>
    </div>
    
    <!-- 文件树 -->
    <div class="tree-container">
      <div v-if="isLoading && fileTreeData.length === 0" class="loading">
        <a-spin />
        <span>加载中...</span>
      </div>
      
      <div v-else-if="fileTreeData.length === 0" class="empty">
        <p>暂无文件</p>
      </div>
      
      <div v-else class="tree-content">
        <FileTreeNodeComponent 
          v-for="node in fileTreeData" 
          :key="node.path"
          :node="node"
          :level="0"
          @select="selectFile"
          @toggle="toggleFolder"
          @contextmenu="showContextMenu"
        />
      </div>
    </div>
    
    <!-- 右键菜单 -->
    <div 
      v-if="contextMenuVisible" 
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
    >
      <div class="menu-item" @click="showCreateModal('file')">
        <FileOutlined /> 新建文件
      </div>
      <div class="menu-item" @click="showCreateModal('folder')">
        <FolderOutlined /> 新建文件夹
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item danger" @click="deleteItem">
        删除
      </div>
    </div>
    
    <!-- 新建项目对话框 -->
    <a-modal 
      v-model:open="showNewItemModal"
      :title="`新建${newItemType === 'file' ? '文件' : '文件夹'}`"
      @ok="confirmCreate"
      @cancel="showNewItemModal = false"
    >
      <a-input 
        v-model:value="newItemName"
        :placeholder="`请输入${newItemType === 'file' ? '文件' : '文件夹'}名称`"
        @press-enter="confirmCreate"
      />
    </a-modal>
  </div>
</template>

<!-- 文件树节点组件 -->


<style scoped lang="less">
.file-tree-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #252526;
  color: #cccccc;
  transition: background-color 0.3s ease, color 0.3s ease;
  
  // 浅色主题
  :global(.theme-light) & {
    background: #f3f3f3;
    color: #383a42;
  }
  
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #3c3c3c;
    background: #2d2d30;
    transition: background-color 0.3s ease, border-color 0.3s ease;
    
    :global(.theme-light) & {
      background: #f8f8f8;
      border-bottom-color: #e5e5e5;
    }
    
    .title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #cccccc;
      transition: color 0.3s ease;
      
      :global(.theme-light) & {
        color: #383a42;
      }
    }
    
    .actions {
      display: flex;
      gap: 4px;
      
      :deep(.ant-btn) {
        color: #cccccc;
        transition: color 0.3s ease;
        
        :global(.theme-light) & {
          color: #383a42;
        }
        
        &:hover {
          color: #ffffff;
          
          :global(.theme-light) & {
            color: #007acc;
          }
        }
      }
    }
  }
  
  .tree-container {
    height: 450px;
    overflow-y: auto;
    overflow-x: hidden;
    flex-shrink: 0;
    
    // 自定义滚动条
    &::-webkit-scrollbar {
      width: 10px;
    }
    
    &::-webkit-scrollbar-track {
      background: #2d2d30;
      
      :global(.theme-light) & {
        background: #f8f8f8;
      }
    }
    
    &::-webkit-scrollbar-thumb {
      background: #424242;
      border-radius: 5px;
      
      :global(.theme-light) & {
        background: #c1c1c1;
      }
      
      &:hover {
        background: #4f4f4f;
        
        :global(.theme-light) & {
          background: #a6a6a6;
        }
      }
    }
    
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 20px;
      color: #969696;
      height: 100%;
      transition: color 0.3s ease;
      
      :global(.theme-light) & {
        color: #6c6c6c;
      }
    }
    
    .empty {
      padding: 20px;
      text-align: center;
      color: #969696;
      height: 100%;
      transition: color 0.3s ease;
      
      :global(.theme-light) & {
        color: #6c6c6c;
      }
    }
    
    .tree-content {
      padding: 0;
      margin: 0;
      line-height: 1;
      
      > * {
        margin: 0;
        padding: 0;
      }
    }
  }
  
  // 文件树节点主题支持
  :deep(.tree-node) {
    .node-content {
      &:hover {
        background: #2a2d2e;
        
        :global(.theme-light) & {
          background: #e8f4fd;
        }
      }
    }
  }
}



.context-menu {
  position: fixed;
  z-index: 1000;
  background: #383838;
  border: 1px solid #5a5a5a;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  min-width: 140px;
  overflow: hidden;
  transition: all 0.2s ease;
  
  :global(.theme-light) & {
    background: #ffffff;
    border-color: #d9d9d9;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: #cccccc;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    
    :global(.theme-light) & {
      color: #333333;
    }
    
    &:hover {
      background: #094771;
      
      :global(.theme-light) & {
        background: #e6f7ff;
      }
    }
    
    &:first-child {
      border-top-left-radius: 6px;
      border-top-right-radius: 6px;
    }
    
    &:last-child {
      border-bottom-left-radius: 6px;
      border-bottom-right-radius: 6px;
    }
    
    &.danger {
      color: #f48771;
      
      :global(.theme-light) & {
        color: #ff4d4f;
      }
      
      &:hover {
        background: #5a1d1d;
        color: #ffffff;
        
        :global(.theme-light) & {
          background: #fff2f0;
          color: #ff4d4f;
        }
      }
    }
    
    .anticon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
  
  .menu-divider {
    height: 1px;
    background: #5a5a5a;
    margin: 4px 0;
    
    :global(.theme-light) & {
      background: #f0f0f0;
    }
  }
}
</style>