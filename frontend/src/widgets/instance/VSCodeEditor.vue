<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRoute } from "vue-router";
import { useScreen } from "@/hooks/useScreen";
import { useLayoutCardTools } from "@/hooks/useCardTools";
import { 
  SettingOutlined, 
  SearchOutlined, 
  SaveOutlined, 
  FolderOutlined,
  BulbOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  FullscreenOutlined
} from "@ant-design/icons-vue";
import type { LayoutCard } from "@/types/index";
import FileTreePanel from "./vscode/FileTreePanel.vue";
import TabsPanel from "./vscode/TabsPanel.vue";
import MonacoEditorPanel from "./vscode/MonacoEditorPanel.vue";
import StatusBar from "./vscode/StatusBar.vue";
import SearchPanel from "./vscode/SearchPanel.vue";
import { useVSCodeStore } from "@/stores/useVSCodeStore";
import { useAppStateStore } from "@/stores/useAppStateStore";

interface Props {
  card: LayoutCard;
}

const props = defineProps<Props>();

const route = useRoute();
const { isPhone } = useScreen();
const { getMetaValue, setMetaValue } = useLayoutCardTools(props.card);
const vscodeStore = useVSCodeStore();
const { state: appState, updateUserInfo, updatePanelStatus } = useAppStateStore();

// 从路由查询参数中获取daemonId和instanceId（兼容instanceUuid）
const daemonId = computed(() => {
  return (route.query.daemonId as string) || (route.params.daemonId as string) || '';
});
const instanceUuid = computed(() => {
  // 优先使用instanceId，兼容旧的instanceUuid参数
  const instanceId = (route.query.instanceId as string) || (route.params.instanceId as string);
  const instanceUuid = (route.query.instanceUuid as string) || (route.params.instanceUuid as string);
  return instanceId || instanceUuid || '';
});

// 界面状态
const isFileTreeVisible = ref(true);
const isSearchPanelVisible = ref(false);
const FIXED_FILE_TREE_WIDTH = 320; // 固定文件树宽度
const FIXED_SEARCH_PANEL_WIDTH = 300; // 固定搜索面板宽度

// 响应式布局
const containerClass = computed(() => ({
  'vscode-editor-container': true,
  'mobile': isPhone.value,
  'theme-dark': vscodeStore.currentTheme === 'dark',
  'theme-light': vscodeStore.currentTheme === 'light'
}));

// 计算编辑器区域宽度
const editorAreaWidth = computed(() => {
  let width = '100%';
  if (isFileTreeVisible.value) {
    width = `calc(100% - ${FIXED_FILE_TREE_WIDTH}px)`;
  }
  if (isSearchPanelVisible.value) {
    width = isFileTreeVisible.value 
      ? `calc(100% - ${FIXED_FILE_TREE_WIDTH + FIXED_SEARCH_PANEL_WIDTH}px)`
      : `calc(100% - ${FIXED_SEARCH_PANEL_WIDTH}px)`;
  }
  return width;
});



// 切换文件树显示
const toggleFileTree = () => {
  isFileTreeVisible.value = !isFileTreeVisible.value;
};

// 切换搜索面板显示
const toggleSearchPanel = () => {
  isSearchPanelVisible.value = !isSearchPanelVisible.value;
};

// 切换主题
const toggleTheme = () => {
  const newTheme = vscodeStore.currentTheme === 'dark' ? 'light' : 'dark';
  vscodeStore.setTheme(newTheme);
};

// 保存当前文件
const isSaving = ref(false);
const saveCurrentFile = async () => {
  if (vscodeStore.activeTab && !isSaving.value) {
    isSaving.value = true;
    try {
      await vscodeStore.saveFile(vscodeStore.activeTab.id);
      // 保存成功后短暂显示动画
      setTimeout(() => {
        isSaving.value = false;
      }, 600);
    } catch (error) {
      isSaving.value = false;
      console.error('保存文件失败:', error);
    }
  }
};

// 刷新文件树
const refreshFileTree = () => {
  vscodeStore.refreshFileTree();
};

// 全屏切换
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};

// 初始化编辑器
onMounted(async () => {
  try {
    // 初始化面板状态和用户信息
    await updatePanelStatus();
    
    // 如果没有用户信息，尝试获取
    if (!appState.userInfo) {
      try {
        await updateUserInfo();
      } catch (err) {
        console.warn('VSCode Editor: Failed to get user info, using test mode', err);
        // 在测试模式下，设置一个临时的用户信息
        appState.userInfo = {
          uuid: 'test-user',
          userName: 'test',
          permission: 10,
          token: 'test-token'
        } as any;
      }
    }
    
    // 参数验证
    if (!daemonId.value || !instanceUuid.value) {
      console.error('VSCode Editor: Missing required parameters', {
        daemonId: daemonId.value,
        instanceUuid: instanceUuid.value
      });
      return;
    }
    
    vscodeStore.initialize({
      daemonId: daemonId.value,
      instanceUuid: instanceUuid.value
    });
  } catch (err) {
    console.error('VSCode Editor: Initialization failed', err);
  }
});

// 清理资源
onUnmounted(() => {
  vscodeStore.cleanup();
});
</script>

<template>
  <div :class="containerClass">
    <!-- 顶部工具栏 -->
    <div class="vscode-toolbar">
      <div class="toolbar-left">
        <a-button 
          type="text" 
          size="small" 
          @click="toggleFileTree"
          :title="isFileTreeVisible ? '隐藏文件树' : '显示文件树'"
          class="toolbar-btn"
        >
          <template #icon>
            <MenuFoldOutlined v-if="isFileTreeVisible" />
            <MenuUnfoldOutlined v-else />
          </template>
        </a-button>
        
        <a-button 
          type="text" 
          size="small" 
          @click="toggleSearchPanel"
          :title="isSearchPanelVisible ? '隐藏搜索' : '显示搜索'"
          class="toolbar-btn"
        >
          <template #icon>
            <SearchOutlined />
          </template>
        </a-button>
        
        <div class="toolbar-divider"></div>
        
        <span class="toolbar-title">
          <FolderOutlined class="title-icon" />
          VSCode Editor
        </span>
      </div>
      
      <div class="toolbar-center">
        <a-button 
          type="text" 
          size="small" 
          @click="saveCurrentFile"
          title="保存文件 (Ctrl+S)"
          :class="['toolbar-btn', 'save-btn', { saving: isSaving }]"
          :disabled="!vscodeStore.activeTab || isSaving"
        >
          <template #icon>
            <SaveOutlined />
          </template>
        </a-button>
        
        <a-button 
          type="text" 
          size="small" 
          @click="refreshFileTree"
          title="刷新文件树"
          class="toolbar-btn"
        >
          <template #icon>
            <ReloadOutlined />
          </template>
        </a-button>
      </div>
      
      <div class="toolbar-right">
        <a-button 
          type="text" 
          size="small" 
          @click="toggleTheme"
          :title="vscodeStore.currentTheme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
          class="toolbar-btn theme-btn"
        >
          <template #icon>
            <BulbOutlined />
          </template>
        </a-button>
        
        <a-button 
          type="text" 
          size="small" 
          @click="toggleFullscreen"
          title="全屏模式"
          class="toolbar-btn"
        >
          <template #icon>
            <FullscreenOutlined />
          </template>
        </a-button>
        
        <a-button 
          type="text" 
          size="small" 
          title="设置"
          class="toolbar-btn"
        >
          <template #icon>
            <SettingOutlined />
          </template>
        </a-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="vscode-main">
      <!-- 文件树面板 -->
      <div 
        v-show="isFileTreeVisible" 
        class="file-tree-panel side-panel"
        :style="{ width: FIXED_FILE_TREE_WIDTH + 'px' }"
      >
        <div class="panel-header">
          <span class="panel-title">资源管理器</span>
          <div class="panel-actions">
            <a-button type="text" size="small" title="新建文件" class="panel-btn">
              <template #icon>
                <i class="codicon codicon-new-file"></i>
              </template>
            </a-button>
            <a-button type="text" size="small" title="新建文件夹" class="panel-btn">
              <template #icon>
                <i class="codicon codicon-new-folder"></i>
              </template>
            </a-button>
          </div>
        </div>
        <FileTreePanel 
          :daemon-id="daemonId"
          :instance-uuid="instanceUuid"
        />
      </div>
      
      <!-- 搜索面板 -->
      <div 
        v-show="isSearchPanelVisible" 
        class="search-panel side-panel"
        :style="{ width: FIXED_SEARCH_PANEL_WIDTH + 'px' }"
      >
        <div class="panel-header">
          <span class="panel-title">搜索</span>
        </div>
        <SearchPanel 
          :daemon-id="daemonId"
          :instance-uuid="instanceUuid"
        />
      </div>

      <!-- 编辑器区域 -->
      <div class="editor-area" :style="{ width: editorAreaWidth }">
        <!-- 标签页 -->
        <TabsPanel />
        
        <!-- Monaco编辑器 -->
        <div class="editor-content">
          <MonacoEditorPanel 
            :daemon-id="daemonId"
            :instance-uuid="instanceUuid"
          />
        </div>
      </div>
    </div>

    <!-- 状态栏 -->
    <StatusBar 
      :daemon-id="daemonId"
      :instance-uuid="instanceUuid"
    />
  </div>
</template>

<style scoped lang="less">
.vscode-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 700px;
  font-family: 'Segoe UI', 'Cascadia Code', 'Fira Code', Consolas, monospace;
  transition: all 0.2s ease;
  
  &.theme-dark {
    background: #1e1e1e;
    color: #cccccc;
  }
  
  &.theme-light {
    background: #ffffff;
    color: #333333;
  }
  
  &.mobile {
    .side-panel {
      position: absolute;
      z-index: 1000;
      height: calc(100% - 44px);
      top: 44px;
      left: 0;
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    }
  }
}

.vscode-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  padding: 0 12px;
  transition: all 0.2s ease;
  
  .theme-dark & {
    background: #2d2d30;
    border-bottom: 1px solid #3c3c3c;
  }
  
  .theme-light & {
    background: #f3f3f3;
    border-bottom: 1px solid #e5e5e5;
  }
  
  .toolbar-left,
  .toolbar-center,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .toolbar-left {
    flex: 1;
    
    .toolbar-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      margin-left: 8px;
      
      .title-icon {
        font-size: 14px;
        opacity: 0.8;
      }
    }
    
    .toolbar-divider {
      width: 1px;
      height: 20px;
      margin: 0 8px;
      
      .theme-dark & {
        background: #3c3c3c;
      }
      
      .theme-light & {
        background: #d0d0d0;
      }
    }
  }
  
  .toolbar-center {
    flex: 0 0 auto;
  }
  
  .toolbar-right {
    flex: 0 0 auto;
  }
  
  .toolbar-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
      transition: left 0.6s ease;
    }
    
    .theme-dark & {
      color: #cccccc;
      
      &:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        
        &::before {
          left: 100%;
        }
      }
      
      &:active {
        background: rgba(255, 255, 255, 0.18);
        transform: translateY(0);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
      }
    }
    
    .theme-light & {
      color: #666666;
      
      &:hover {
        background: rgba(0, 0, 0, 0.08);
        color: #333333;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        
        &::before {
          background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.1), transparent);
          left: 100%;
        }
      }
      
      &:active {
        background: rgba(0, 0, 0, 0.12);
        transform: translateY(0);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
      }
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      
      &:hover {
        background: transparent !important;
        transform: none !important;
        box-shadow: none !important;
        
        &::before {
          left: -100% !important;
        }
      }
    }
    
    // 特殊按钮样式
    &.save-btn {
      .theme-dark & {
        &:hover {
          background: rgba(14, 99, 156, 0.8);
          color: #ffffff;
        }
      }
      
      .theme-light & {
        &:hover {
          background: rgba(24, 144, 255, 0.1);
          color: #1890ff;
        }
      }
    }
    
    &.theme-btn {
      .theme-dark & {
        &:hover {
          background: rgba(255, 193, 7, 0.2);
          color: #ffc107;
        }
      }
      
      .theme-light & {
        &:hover {
          background: rgba(255, 193, 7, 0.1);
          color: #fa8c16;
        }
      }
    }
  }
}

.vscode-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.side-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
  
  .theme-dark & {
    background: #252526;
    border-right: 1px solid #3c3c3c;
  }
  
  .theme-light & {
    background: #f8f8f8;
    border-right: 1px solid #e5e5e5;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 35px;
    padding: 0 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    
    .theme-dark & {
      background: #2d2d30;
      border-bottom: 1px solid #3c3c3c;
      color: #cccccc;
    }
    
    .theme-light & {
      background: #f3f3f3;
      border-bottom: 1px solid #e5e5e5;
      color: #666666;
    }
    
    .panel-title {
      opacity: 0.9;
    }
    
    .panel-actions {
      display: flex;
      gap: 2px;
      
      .panel-btn {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        font-size: 12px;
        
        .theme-dark & {
          color: #cccccc;
          
          &:hover {
            background: rgba(255, 255, 255, 0.1);
          }
        }
        
        .theme-light & {
          color: #666666;
          
          &:hover {
            background: rgba(0, 0, 0, 0.05);
          }
        }
      }
    }
  }
}

.file-tree-panel {
  .panel-header {
    .panel-title::before {
      content: '📁';
      margin-right: 6px;
    }
  }
}

.search-panel {
  .panel-header {
    .panel-title::before {
      content: '🔍';
      margin-right: 6px;
    }
  }
}

.editor-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 600px;
  
  .editor-content {
    flex: 1;
    overflow: hidden;
    min-height: 500px;
  }
}

// Ant Design 组件样式覆盖
:deep(.ant-btn) {
  border: none;
  background: transparent;
  box-shadow: none;
  
  .theme-dark & {
    color: #cccccc;
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
    
    &:focus {
      background: rgba(255, 255, 255, 0.05);
    }
  }
  
  .theme-light & {
    color: #666666;
    
    &:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #333333;
    }
    
    &:focus {
      background: rgba(0, 0, 0, 0.02);
    }
  }
}

// VSCode图标字体
@font-face {
  font-family: 'codicon';
  src: url('https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.32/dist/codicon.ttf') format('truetype');
}

.codicon {
  font-family: 'codicon';
  font-size: 16px;
  line-height: 1;
  
  &.codicon-new-file::before {
    content: '\eaa3';
  }
  
  &.codicon-new-folder::before {
    content: '\eaa4';
  }
}

// 滚动条样式
:deep(::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(::-webkit-scrollbar-track) {
  .theme-dark & {
    background: #1e1e1e;
  }
  
  .theme-light & {
    background: #f8f8f8;
  }
}

:deep(::-webkit-scrollbar-thumb) {
  border-radius: 4px;
  
  .theme-dark & {
    background: #424242;
    
    &:hover {
      background: #4f4f4f;
    }
  }
  
  .theme-light & {
    background: #c1c1c1;
    
    &:hover {
      background: #a8a8a8;
    }
  }
}

// 动画效果
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.side-panel {
  animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &.file-tree-panel {
    animation: slideInLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  &.search-panel {
    animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.vscode-toolbar {
  .toolbar-left {
    animation: slideInLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .toolbar-right {
    animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

// 保存成功动画
.save-btn {
  &.saving {
    animation: pulse 0.6s ease-in-out;
    
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(24, 144, 255, 0.3),
        transparent
      );
      background-size: 200px 100%;
      animation: shimmer 1s ease-in-out;
    }
  }
}

// 主题切换动画
.theme-btn {
  .anticon {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  &:hover .anticon {
    transform: rotate(180deg) scale(1.1);
  }
}

// 面板标题动画
.panel-title {
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 0;
    height: 2px;
    background: linear-gradient(90deg, #007acc, #1890ff);
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .panel-header:hover &::after {
    width: 100%;
  }
}
</style>