<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useCommandHistoryStore, type CommandHistoryItem } from '@/stores/useCommandHistoryStore';
import { 
  HistoryOutlined, 
  DeleteOutlined, 
  SearchOutlined, 
  CloseOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  ClearOutlined
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

const props = defineProps<{
  onCommandSelect?: (command: string) => void;
}>();

const historyStore = useCommandHistoryStore();
const searchInputRef = ref<HTMLInputElement>();
const panelRef = ref<HTMLElement>();
const listRef = ref<HTMLElement>();

// 格式化时间
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) { // 1分钟内
    return '刚刚';
  } else if (diff < 3600000) { // 1小时内
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) { // 1天内
    return `${Math.floor(diff / 3600000)}小时前`;
  } else {
    return date.toLocaleDateString();
  }
};

// 处理命令选择
const handleCommandSelect = (item: CommandHistoryItem) => {
  historyStore.selectCommand(item.command);
  props.onCommandSelect?.(item.command);
  historyStore.hidePanel();
};

// 复制命令到剪贴板
const copyCommand = async (command: string, event: Event) => {
  event.stopPropagation();
  try {
    await navigator.clipboard.writeText(command);
    message.success('命令已复制到剪贴板');
  } catch (error) {
    message.error('复制失败');
  }
};

// 删除单个命令
const deleteCommand = (id: string, event: Event) => {
  event.stopPropagation();
  historyStore.removeCommand(id);
  message.success('命令已删除');
};

// 清空所有历史
const clearAllHistory = () => {
  historyStore.clearHistory();
  message.success('历史记录已清空');
};

// 键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  if (!historyStore.isPanelVisible) return;
  
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      historyStore.navigateUp();
      scrollToSelected();
      break;
    case 'ArrowDown':
      event.preventDefault();
      historyStore.navigateDown();
      scrollToSelected();
      break;
    case 'Enter':
      event.preventDefault();
      const command = historyStore.selectCurrentItem();
      if (command) {
        props.onCommandSelect?.(command);
      }
      break;
    case 'Escape':
      event.preventDefault();
      historyStore.hidePanel();
      break;
  }
};

// 滚动到选中项
const scrollToSelected = async () => {
  await nextTick();
  const selectedElement = listRef.value?.querySelector('.history-item.selected');
  if (selectedElement) {
    selectedElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }
};

// 点击外部关闭面板（保持原有逻辑，但现在是卡片形式）
const handleClickOutside = (event: Event) => {
  if (panelRef.value && !panelRef.value.contains(event.target as Node)) {
    // 检查点击是否在输入框或历史按钮上，如果是则不关闭
    const target = event.target as HTMLElement;
    const isInputArea = target.closest('.command-input') || target.closest('.ant-input') || target.closest('.ant-btn');
    if (!isInputArea) {
      historyStore.hidePanel();
    }
  }
};

// 搜索输入处理
const handleSearchInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  historyStore.setSearchQuery(target.value);
};

// 清空搜索
const clearSearch = () => {
  historyStore.setSearchQuery('');
  searchInputRef.value?.focus();
};

// 生命周期
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('click', handleClickOutside);
});

// 统计信息
const stats = computed(() => historyStore.getStats());
</script>

<template>
  <div 
    v-if="historyStore.isPanelVisible" 
    ref="panelRef"
    class="command-history-card"
  >
    <!-- 面板头部 -->
    <div class="panel-header">
      <div class="header-left">
        <HistoryOutlined class="header-icon" />
        <span class="header-title">命令历史</span>
        <span class="header-count">({{ historyStore.filteredHistory.length }})</span>
      </div>
      <div class="header-right">
        <a-tooltip title="清空所有历史">
          <a-button 
            type="text" 
            size="small" 
            @click="clearAllHistory"
            :disabled="historyStore.historyItems.length === 0"
          >
            <ClearOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="关闭面板">
          <a-button 
            type="text" 
            size="small" 
            @click="historyStore.hidePanel"
          >
            <CloseOutlined />
          </a-button>
        </a-tooltip>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="search-container">
      <a-input
        ref="searchInputRef"
        v-model:value="historyStore.searchQuery"
        placeholder="搜索历史命令..."
        size="small"
        @input="handleSearchInput"
      >
        <template #prefix>
          <SearchOutlined class="search-icon" />
        </template>
        <template #suffix>
          <a-button 
            v-if="historyStore.searchQuery"
            type="text" 
            size="small"
            @click="clearSearch"
          >
            <CloseOutlined />
          </a-button>
        </template>
      </a-input>
    </div>

    <!-- 历史命令列表 -->
    <div class="history-list-container">
      <div 
        v-if="historyStore.filteredHistory.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">
          <HistoryOutlined />
        </div>
        <div class="empty-text">
          {{ historyStore.searchQuery ? '未找到匹配的命令' : '暂无历史命令' }}
        </div>
      </div>
      
      <div 
        v-else
        ref="listRef"
        class="history-list"
      >
        <div
          v-for="(item, index) in historyStore.filteredHistory"
          :key="item.id"
          class="history-item"
          :class="{ 
            'selected': index === historyStore.selectedIndex,
            'frequent': item.executionCount > 5
          }"
          @click="handleCommandSelect(item)"
        >
          <div class="item-content">
            <div class="command-text">{{ item.command }}</div>
            <div class="item-meta">
              <span class="timestamp">
                <ClockCircleOutlined class="meta-icon" />
                {{ formatTime(item.timestamp) }}
              </span>
              <span v-if="item.executionCount > 1" class="execution-count">
                执行 {{ item.executionCount }} 次
              </span>
            </div>
          </div>
          <div class="item-actions">
            <a-tooltip title="复制命令">
              <a-button 
                type="text" 
                size="small"
                @click="copyCommand(item.command, $event)"
              >
                <CopyOutlined />
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除">
              <a-button 
                type="text" 
                size="small"
                danger
                @click="deleteCommand(item.id, $event)"
              >
                <DeleteOutlined />
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- 面板底部统计 -->
    <div v-if="stats.totalCommands > 0" class="panel-footer">
      <div class="stats">
        <span class="stat-item">
          总计: {{ stats.totalCommands }} 条命令
        </span>
        <span class="stat-item">
          执行: {{ stats.totalExecutions }} 次
        </span>
      </div>
      <div class="keyboard-hint">
        <span>↑↓ 选择</span>
        <span>Enter 确认</span>
        <span>Esc 关闭</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.command-history-card {
  margin-top: 12px;
  background: #ffffff;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 400px;
  display: flex;
  flex-direction: column;
  animation: slideDown 0.2s ease-out;
  overflow: hidden;
}

/* 暗色主题支持 */
@media (prefers-color-scheme: dark) {
  .command-history-card {
    background: #1f1f1f;
    border-color: #434343;
  }
  
  .panel-header {
    background: #262626;
    border-bottom-color: #434343;
  }
  
  .panel-footer {
    background: #262626;
    border-top-color: #434343;
    color: #a6a6a6;
  }
  
  .search-container {
    border-bottom-color: #434343;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 400px;
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #000000;
  border-radius: 8px 8px 0 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-icon {
      color: #ffffff;
      font-size: 16px;
    }

    .header-title {
      font-weight: 500;
      color: #ffffff;
    }

    .header-count {
      color: #ffffff;
      font-size: 12px;
    }
  }

  .header-right {
    display: flex;
    gap: 4px;
    
    .ant-btn {
      color: #ffffff;
      
      &:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }
}

.search-container {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;

  .search-icon {
    color: var(--color-text-tertiary);
  }
}

.history-list-container {
  flex: 1;
  overflow: hidden;
  min-height: 200px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-tertiary);

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .empty-text {
    font-size: 14px;
  }
}

.history-list {
  max-height: 250px;
  overflow-y: auto;
  padding: 8px 0;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--color-fill-quaternary);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-fill-secondary);
    border-radius: 3px;

    &:hover {
      background: var(--color-fill);
    }
  }
}

.history-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;

  &:hover {
    background: var(--color-fill-quaternary);
  }

  &.selected {
    background: var(--color-primary-bg);
    border-left-color: var(--color-primary);
  }

  &.frequent {
    border-left-color: var(--color-warning);

    &.selected {
      border-left-color: var(--color-primary);
    }
  }

  .item-content {
    flex: 1;
    min-width: 0;

    .command-text {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #ffffff;
      margin-bottom: 4px;
      word-break: break-all;
      line-height: 1.4;
    }

    .item-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #ffffff;

      .meta-icon {
        margin-right: 2px;
        color: #ffffff;
      }

      .timestamp {
        color: #ffffff;
      }

      .execution-count {
        color: #ffffff;
        font-weight: 500;
      }
    }
  }

  .item-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover .item-actions {
    opacity: 1;
  }
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-top: 1px solid #f0f0f0;
  background: #000000;
  border-radius: 0 0 8px 8px;
  font-size: 11px;
  color: #ffffff;

  .stats {
    display: flex;
    gap: 16px;

    .stat-item {
      display: flex;
      align-items: center;
      color: #ffffff;
    }
  }

  .keyboard-hint {
    display: flex;
    gap: 8px;

    span {
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      font-size: 10px;
      color: #ffffff;
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .command-history-card {
    max-height: 300px;
    margin-top: 8px;
  }

  .history-list {
    max-height: 180px;
  }

  .panel-footer {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .keyboard-hint {
    align-self: stretch;
    justify-content: center;
  }
}
</style>