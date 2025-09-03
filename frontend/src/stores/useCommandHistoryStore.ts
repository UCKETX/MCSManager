import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const TERMINAL_HISTORY_KEY = 'TERMINAL_HISTORY_KEY';
const HISTORY_PANEL_VISIBLE_KEY = 'HISTORY_PANEL_VISIBLE_KEY';

export interface CommandHistoryItem {
  id: string;
  command: string;
  timestamp: number;
  executionCount: number;
}

export const useCommandHistoryStore = defineStore('commandHistory', () => {
  const commandInputValue = ref<string>('');
  const historyItems = ref<CommandHistoryItem[]>([]);
  const isPanelVisible = ref<boolean>(false);
  const selectedIndex = ref<number>(-1);
  const searchQuery = ref<string>('');
  const maxHistorySize = ref<number>(100);

  // 计算属性：过滤后的历史记录
  const filteredHistory = computed(() => {
    if (!searchQuery.value) {
      return historyItems.value;
    }
    return historyItems.value.filter(item =>
      item.command.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  });

  // 计算属性：最近的历史记录（用于快速访问）
  const recentHistory = computed(() => {
    return historyItems.value.slice(0, 20);
  });

  // 从localStorage加载历史记录
  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(TERMINAL_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        // 转换旧格式到新格式
        historyItems.value = parsed.map((cmd, index) => ({
          id: `${Date.now()}-${index}`,
          command: cmd,
          timestamp: Date.now() - (parsed.length - index) * 1000,
          executionCount: 1
        }));
      }

      const panelVisible = localStorage.getItem(HISTORY_PANEL_VISIBLE_KEY);
      if (panelVisible !== null) {
        isPanelVisible.value = JSON.parse(panelVisible);
      }
    } catch (error) {
      console.error('Failed to load command history:', error);
      historyItems.value = [];
    }
  };

  // 保存历史记录到localStorage
  const saveHistory = () => {
    try {
      // 保持与旧格式的兼容性
      const commands = historyItems.value.map(item => item.command);
      localStorage.setItem(TERMINAL_HISTORY_KEY, JSON.stringify(commands));
      localStorage.setItem(HISTORY_PANEL_VISIBLE_KEY, JSON.stringify(isPanelVisible.value));
    } catch (error) {
      console.error('Failed to save command history:', error);
    }
  };

  // 添加命令到历史记录
  const addCommand = (command: string) => {
    if (!command.trim()) return;

    const existingIndex = historyItems.value.findIndex(item => item.command === command);

    if (existingIndex !== -1) {
      // 如果命令已存在，更新执行次数并移到最前面
      const existingItem = historyItems.value[existingIndex];
      existingItem.executionCount++;
      existingItem.timestamp = Date.now();
      historyItems.value.splice(existingIndex, 1);
      historyItems.value.unshift(existingItem);
    } else {
      // 添加新命令
      const newItem: CommandHistoryItem = {
        id: `${Date.now()}-${Math.random()}`,
        command,
        timestamp: Date.now(),
        executionCount: 1
      };
      historyItems.value.unshift(newItem);
    }

    // 限制历史记录数量
    if (historyItems.value.length > maxHistorySize.value) {
      historyItems.value = historyItems.value.slice(0, maxHistorySize.value);
    }

    saveHistory();
  };

  // 删除指定命令
  const removeCommand = (id: string) => {
    const index = historyItems.value.findIndex(item => item.id === id);
    if (index !== -1) {
      historyItems.value.splice(index, 1);
      saveHistory();
    }
  };

  // 清空所有历史记录
  const clearHistory = () => {
    historyItems.value = [];
    selectedIndex.value = -1;
    saveHistory();
  };

  // 选择命令
  const selectCommand = (command: string) => {
    commandInputValue.value = command;
  };

  // 切换面板可见性
  const togglePanel = () => {
    isPanelVisible.value = !isPanelVisible.value;
    saveHistory();
  };

  // 显示面板
  const showPanel = () => {
    isPanelVisible.value = true;
    saveHistory();
  };

  // 隐藏面板
  const hidePanel = () => {
    isPanelVisible.value = false;
    selectedIndex.value = -1;
    saveHistory();
  };

  // 键盘导航
  const navigateUp = () => {
    const items = filteredHistory.value;
    if (items.length === 0) return;

    if (selectedIndex.value <= 0) {
      selectedIndex.value = items.length - 1;
    } else {
      selectedIndex.value--;
    }
  };

  const navigateDown = () => {
    const items = filteredHistory.value;
    if (items.length === 0) return;

    if (selectedIndex.value >= items.length - 1) {
      selectedIndex.value = 0;
    } else {
      selectedIndex.value++;
    }
  };

  const selectCurrentItem = () => {
    const items = filteredHistory.value;
    if (selectedIndex.value >= 0 && selectedIndex.value < items.length) {
      const selectedItem = items[selectedIndex.value];
      selectCommand(selectedItem.command);
      hidePanel();
      return selectedItem.command;
    }
    return null;
  };

  // 搜索功能
  const setSearchQuery = (query: string) => {
    searchQuery.value = query;
    selectedIndex.value = -1;
  };

  // 获取统计信息
  const getStats = () => {
    return {
      totalCommands: historyItems.value.length,
      totalExecutions: historyItems.value.reduce((sum, item) => sum + item.executionCount, 0),
      mostUsedCommand: historyItems.value.reduce((prev, current) =>
        (prev.executionCount > current.executionCount) ? prev : current, historyItems.value[0]
      )
    };
  };

  // 初始化
  loadHistory();

  return {
    // 状态
    commandInputValue,
    historyItems,
    isPanelVisible,
    selectedIndex,
    searchQuery,
    maxHistorySize,

    // 计算属性
    filteredHistory,
    recentHistory,

    // 方法
    loadHistory,
    saveHistory,
    addCommand,
    removeCommand,
    clearHistory,
    selectCommand,
    togglePanel,
    showPanel,
    hidePanel,
    navigateUp,
    navigateDown,
    selectCurrentItem,
    setSearchQuery,
    getStats
  };
});