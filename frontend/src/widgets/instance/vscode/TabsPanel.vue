<script setup lang="ts">
import { computed, ref } from 'vue';
import { CloseOutlined, FileOutlined } from '@ant-design/icons-vue';
import { useVSCodeStore, type FileTab } from '@/stores/useVSCodeStore';
import { message } from 'ant-design-vue';

const vscodeStore = useVSCodeStore();
const draggedTab = ref<FileTab | null>(null);
const dragOverIndex = ref(-1);

// 计算标签页数据
const tabs = computed(() => vscodeStore.fileTabs);
const activeTabId = computed(() => vscodeStore.activeTab?.id);

// 获取文件图标样式类
const getFileIconClass = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    'js': 'tab-icon-js',
    'jsx': 'tab-icon-js',
    'ts': 'tab-icon-ts',
    'tsx': 'tab-icon-ts',
    'vue': 'tab-icon-vue',
    'py': 'tab-icon-python',
    'json': 'tab-icon-json',
    'html': 'tab-icon-html',
    'htm': 'tab-icon-html',
    'css': 'tab-icon-css',
    'scss': 'tab-icon-css',
    'less': 'tab-icon-css',
    'md': 'tab-icon-markdown',
    'yml': 'tab-icon-yaml',
    'yaml': 'tab-icon-yaml',
    'xml': 'tab-icon-xml',
    'sql': 'tab-icon-sql',
    'sh': 'tab-icon-shell',
    'bash': 'tab-icon-shell',
    'dockerfile': 'tab-icon-docker',
    'gitignore': 'tab-icon-git',
    'env': 'tab-icon-env'
  };
  
  return iconMap[ext || ''] || 'tab-icon-default';
};

// 切换标签页
const switchTab = (tabId: string) => {
  vscodeStore.switchToTab(tabId);
};

// 关闭标签页
const closeTab = async (event: Event, tabId: string) => {
  event.stopPropagation();
  
  const tab = vscodeStore.fileTabs.find(t => t.id === tabId);
  if (!tab) return;
  
  // 如果文件有未保存的更改，询问用户
  if (tab.isDirty) {
    const { Modal } = await import('ant-design-vue');
    
    Modal.confirm({
      title: '未保存的更改',
      content: `文件 "${tab.name}" 有未保存的更改，是否保存？`,
      okText: '保存',
      cancelText: '不保存',
      onOk: async () => {
        try {
          const success = await vscodeStore.saveFile(tabId);
          if (success) {
            vscodeStore.closeFile(tabId);
          } else {
            message.error('保存失败');
          }
        } catch (error) {
          console.error('Save file error:', error);
          message.error('保存失败');
        }
      },
      onCancel: () => {
        vscodeStore.closeFile(tabId);
      }
    });
  } else {
    vscodeStore.closeFile(tabId);
  }
};

// 关闭其他标签页
const closeOtherTabs = async (keepTabId: string) => {
  const tabsToClose = vscodeStore.fileTabs.filter(tab => tab.id !== keepTabId);
  const modifiedTabs = tabsToClose.filter(tab => tab.isDirty);
  
  if (modifiedTabs.length > 0) {
    const { Modal } = await import('ant-design-vue');
    
    Modal.confirm({
      title: '未保存的更改',
      content: `有 ${modifiedTabs.length} 个文件有未保存的更改，是否保存？`,
      okText: '保存全部',
      cancelText: '不保存',
      onOk: async () => {
        try {
          const success = await vscodeStore.saveAllFiles();
          if (success) {
            tabsToClose.forEach(tab => vscodeStore.closeFile(tab.id));
          } else {
            message.error('保存失败');
          }
        } catch (error) {
          console.error('Save files error:', error);
          message.error('保存失败');
        }
      },
      onCancel: () => {
        tabsToClose.forEach(tab => vscodeStore.closeFile(tab.id));
      }
    });
  } else {
    tabsToClose.forEach(tab => vscodeStore.closeFile(tab.id));
  }
};

// 关闭所有标签页
const closeAllTabs = async () => {
  const modifiedTabs = vscodeStore.fileTabs.filter(tab => tab.isDirty);
  
  if (modifiedTabs.length > 0) {
    const { Modal } = await import('ant-design-vue');
    
    Modal.confirm({
      title: '未保存的更改',
      content: `有 ${modifiedTabs.length} 个文件有未保存的更改，是否保存？`,
      okText: '保存全部',
      cancelText: '不保存',
      onOk: async () => {
        try {
          const success = await vscodeStore.saveAllFiles();
          if (success) {
            vscodeStore.closeAllTabs();
          } else {
            message.error('保存失败');
          }
        } catch (error) {
          console.error('Save files error:', error);
          message.error('保存失败');
        }
      },
      onCancel: () => {
        vscodeStore.closeAllTabs();
      }
    });
  } else {
    vscodeStore.closeAllTabs();
  }
};

// 显示标签页右键菜单
const showTabContextMenu = (event: MouseEvent, tab: FileTab) => {
  event.preventDefault();
  event.stopPropagation();
  
  // 这里可以实现右键菜单逻辑
  // 暂时使用简单的菜单项
  const menu = [
    {
      label: '关闭',
      action: () => closeTab(event, tab.id)
    },
    {
      label: '关闭其他',
      action: () => closeOtherTabs(tab.id)
    },
    {
      label: '关闭全部',
      action: () => closeAllTabs()
    }
  ];
  
  // 简单实现：显示原生右键菜单
  console.log('Tab context menu:', menu);
};

// 拖拽开始
const onDragStart = (event: DragEvent, tab: FileTab) => {
  draggedTab.value = tab;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tab.id);
  }
};

// 拖拽结束
const onDragEnd = () => {
  draggedTab.value = null;
  dragOverIndex.value = -1;
};

// 拖拽经过
const onDragOver = (event: DragEvent, index: number) => {
  event.preventDefault();
  dragOverIndex.value = index;
};

// 拖拽离开
const onDragLeave = () => {
  dragOverIndex.value = -1;
};

// 放置
const onDrop = (event: DragEvent, targetIndex: number) => {
  event.preventDefault();
  
  if (!draggedTab.value) return;
  
  const sourceIndex = vscodeStore.fileTabs.findIndex(tab => tab.id === draggedTab.value!.id);
  if (sourceIndex === -1 || sourceIndex === targetIndex) return;
  
  // 重新排序标签页
  vscodeStore.reorderTabs(sourceIndex, targetIndex);
  
  draggedTab.value = null;
  dragOverIndex.value = -1;
};
</script>

<template>
  <div class="tabs-panel">
    <div class="tabs-container">
      <!-- 标签页列表 -->
      <div 
        v-for="(tab, index) in tabs" 
        :key="tab.id"
        class="tab-item"
        :class="{
          'active': tab.id === activeTabId,
          'modified': tab.isDirty,
          'drag-over': dragOverIndex === index
        }"
        draggable="true"
        @click="switchTab(tab.id)"
        @contextmenu="showTabContextMenu($event, tab)"
        @dragstart="onDragStart($event, tab)"
        @dragend="onDragEnd"
        @dragover="onDragOver($event, index)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, index)"
      >
        <!-- 文件图标 -->
        <div class="tab-icon" :class="getFileIconClass(tab.name)">
          <FileOutlined />
        </div>
        
        <!-- 文件名 -->
        <div class="tab-name" :title="tab.path">
          {{ tab.name }}
        </div>
        
        <!-- 修改状态指示器 -->
        <div v-if="tab.isDirty" class="modified-indicator">●</div>
        
        <!-- 关闭按钮 -->
        <div 
          class="close-button"
          @click="closeTab($event, tab.id)"
          @mousedown.stop
        >
          <CloseOutlined />
        </div>
      </div>
      
      <!-- 空状态 -->
      <div v-if="tabs.length === 0" class="empty-tabs">
        <span>暂无打开的文件</span>
      </div>
    </div>
    
    <!-- 标签页操作按钮 -->
    <div v-if="tabs.length > 0" class="tabs-actions">
      <a-dropdown placement="bottomRight">
        <a-button type="text" size="small" class="more-button">
          ⋯
        </a-button>
        <template #overlay>
          <a-menu>
            <a-menu-item key="close-all" @click="closeAllTabs">
              关闭全部标签页
            </a-menu-item>
            <a-menu-item 
              key="save-all" 
              @click="vscodeStore.saveAllFiles"
              :disabled="vscodeStore.dirtyTabs.length === 0"
            >
              保存全部 ({{ vscodeStore.dirtyTabs.length }})
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>
  </div>
</template>

<style scoped lang="less">
.tabs-panel {
  display: flex;
  align-items: center;
  height: 35px;
  overflow: hidden;
  transition: all 0.2s ease;
  
  // 深色主题
  .theme-dark & {
    background: #2d2d30;
    border-bottom: 1px solid #3c3c3c;
  }
  
  // 浅色主题
  .theme-light & {
    background: #f3f3f3;
    border-bottom: 1px solid #e5e5e5;
  }
  
  .tabs-container {
    flex: 1;
    display: flex;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    
    &::-webkit-scrollbar {
      height: 3px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      background: #424242;
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: #4f4f4f;
    }
    
    .empty-tabs {
      padding: 0 16px;
      color: #969696;
      font-size: 12px;
      font-style: italic;
    }
  }
  
  .tabs-actions {
    padding: 0 8px;
    
    .theme-dark & {
      border-left: 1px solid #3c3c3c;
    }
    
    .theme-light & {
      border-left: 1px solid #e5e5e5;
    }
    
    .more-button {
      font-size: 16px;
      font-weight: bold;
      transition: all 0.2s ease;
      
      .theme-dark & {
        color: #cccccc;
        
        &:hover {
          background: #3c3c3c;
        }
      }
      
      .theme-light & {
        color: #666666;
        
        &:hover {
          background: #e5e5e5;
        }
      }
    }
  }
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 35px;
  cursor: pointer;
  user-select: none;
  min-width: 120px;
  max-width: 200px;
  position: relative;
  transition: all 0.2s ease;
  
  // 深色主题
  .theme-dark & {
    background: #2d2d30;
    border-right: 1px solid #3c3c3c;
  }
  
  // 浅色主题
  .theme-light & {
    background: #f3f3f3;
    border-right: 1px solid #e5e5e5;
  }
  
  &:hover {
    .theme-dark & {
      background: #37373d;
    }
    
    .theme-light & {
      background: #e8e8e8;
    }
    
    .close-button {
      opacity: 1;
    }
  }
  
  &.active {
    border-bottom: 2px solid #007acc;
    
    .theme-dark & {
      background: #1e1e1e;
      
      .tab-name {
        color: #ffffff;
      }
    }
    
    .theme-light & {
      background: #ffffff;
      
      .tab-name {
        color: #333333;
      }
    }
  }
  
  &.modified {
    .tab-name {
      font-style: italic;
    }
    
    .modified-indicator {
      color: #ffffff;
    }
  }
  
  &.drag-over {
    background: #094771;
    
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #007acc;
    }
  }
  
  .tab-icon {
    display: flex;
    align-items: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    
    :deep(.anticon) {
      font-size: 14px;
    }
    
    // 文件类型图标颜色
    &.tab-icon-js {
      color: #f7df1e;
    }
    
    &.tab-icon-ts {
      color: #3178c6;
    }
    
    &.tab-icon-vue {
      color: #4fc08d;
    }
    
    &.tab-icon-python {
      color: #3776ab;
    }
    
    &.tab-icon-json {
      color: #ffd700;
    }
    
    &.tab-icon-html {
      color: #e34f26;
    }
    
    &.tab-icon-css {
      color: #1572b6;
    }
    
    &.tab-icon-markdown {
      color: #083fa1;
    }
    
    &.tab-icon-yaml {
      color: #cb171e;
    }
    
    &.tab-icon-xml {
      color: #ff6600;
    }
    
    &.tab-icon-sql {
      color: #336791;
    }
    
    &.tab-icon-shell {
      color: #89e051;
    }
    
    &.tab-icon-docker {
      color: #2496ed;
    }
    
    &.tab-icon-git {
      color: #f05032;
    }
    
    &.tab-icon-env {
      color: #ecd53f;
    }
    
    &.tab-icon-default {
      color: #cccccc;
    }
  }
  
  .tab-name {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1;
    transition: color 0.2s ease;
    
    .theme-dark & {
      color: #cccccc;
    }
    
    .theme-light & {
      color: #666666;
    }
  }
  
  .modified-indicator {
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.2s ease;
    
    .theme-dark & {
      color: #cccccc;
    }
    
    .theme-light & {
      color: #666666;
    }
  }
  
  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s, background-color 0.2s;
    flex-shrink: 0;
    
    :deep(.anticon) {
      font-size: 10px;
      transition: color 0.2s ease;
      
      .theme-dark & {
        color: #cccccc;
      }
      
      .theme-light & {
        color: #666666;
      }
    }
    
    &:hover {
      background: #e81123;
      
      :deep(.anticon) {
        color: #ffffff;
      }
    }
  }
  
  &.active .close-button,
  &.modified .close-button {
    opacity: 1;
  }
}

// 拖拽样式
.tab-item[draggable="true"] {
  &:active {
    opacity: 0.8;
  }
}
</style>