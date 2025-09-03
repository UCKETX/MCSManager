import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { editor } from 'monaco-editor';
import { fileContent } from '@/services/apis/fileManager';

export interface FileTab {
  id: string;
  name: string;
  path: string;
  content: string;
  isDirty: boolean;
  language: string;
  encoding: string;
  lineEnding: string;
  cursorPosition: { line: number; column: number };
  isActive: boolean;
}

export interface EditorConfig {
  theme: 'vs-dark' | 'vs-light' | 'hc-black';
  fontSize: number;
  lineHeight: number;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative' | 'interval';
  autoSave: 'off' | 'afterDelay' | 'onFocusChange' | 'onWindowChange';
  autoSaveDelay: number;
  codeFolding: boolean;
  bracketMatching: boolean;
  autoClosingBrackets: boolean;
  autoClosingQuotes: boolean;
  formatOnSave: boolean;
  formatOnPaste: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: number;
  children?: FileTreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

export interface VSCodeContext {
  daemonId: string;
  instanceUuid: string;
}

export const useVSCodeStore = defineStore('vscode', () => {
  // 基础状态
  const context = ref<VSCodeContext | null>(null);
  const isInitialized = ref(false);
  
  // 文件标签页管理
  const fileTabs = ref<FileTab[]>([]);
  const activeTabId = ref<string | null>(null);
  
  // 文件树状态
  const fileTree = ref<FileTreeNode[]>([]);
  const expandedFolders = ref<Set<string>>(new Set());
  const selectedFile = ref<string | null>(null);
  
  // 编辑器配置
  const editorConfig = ref<EditorConfig>({
    theme: 'vs-dark',
    fontSize: 14,
    lineHeight: 20,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    minimap: true,
    lineNumbers: 'on',
    autoSave: 'afterDelay',
    autoSaveDelay: 1000,
    codeFolding: true,
    bracketMatching: true,
    autoClosingBrackets: true,
    autoClosingQuotes: true,
    formatOnSave: false,
    formatOnPaste: false
  });
  
  // Monaco编辑器实例
  const monacoEditor = ref<editor.IStandaloneCodeEditor | null>(null);
  
  // 主题状态
  const currentTheme = ref<'dark' | 'light'>('dark');
  
  // 搜索状态
  const searchState = ref({
    isSearchVisible: false,
    searchQuery: '',
    replaceQuery: '',
    matchCase: false,
    wholeWord: false,
    useRegex: false,
    searchResults: [] as any[],
    currentResultIndex: 0
  });
  
  // 快捷键状态
  const keyboardShortcuts = ref(new Map<string, () => void>());
  
  // 计算属性
  const activeTab = computed(() => {
    return fileTabs.value.find(tab => tab.id === activeTabId.value) || null;
  });
  
  const dirtyTabs = computed(() => {
    return fileTabs.value.filter(tab => tab.isDirty);
  });
  
  const hasUnsavedChanges = computed(() => {
    return dirtyTabs.value.length > 0;
  });
  
  // 初始化
  const initialize = (ctx: VSCodeContext) => {
    context.value = ctx;
    isInitialized.value = true;
    loadEditorConfig();
  };
  
  // 清理资源
  const cleanup = () => {
    if (monacoEditor.value) {
      monacoEditor.value.dispose();
      monacoEditor.value = null;
    }
    fileTabs.value = [];
    activeTabId.value = null;
    fileTree.value = [];
    expandedFolders.value.clear();
    selectedFile.value = null;
    isInitialized.value = false;
    context.value = null;
  };
  
  // 文件标签页操作
  const openFile = (filePath: string, fileName: string, content: string = '', language: string = 'plaintext') => {
    const existingTab = fileTabs.value.find(tab => tab.path === filePath);
    
    if (existingTab) {
      // 切换到已存在的标签页
      activeTabId.value = existingTab.id;
      return existingTab;
    }
    
    // 创建新标签页
    const newTab: FileTab = {
      id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: fileName,
      path: filePath,
      content,
      isDirty: false,
      language,
      encoding: 'UTF-8',
      lineEnding: 'LF',
      cursorPosition: { line: 1, column: 1 },
      isActive: true
    };
    
    fileTabs.value.push(newTab);
    activeTabId.value = newTab.id;
    
    return newTab;
  };
  
  const closeFile = (tabId: string) => {
    const tabIndex = fileTabs.value.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;
    
    const tab = fileTabs.value[tabIndex];
    
    // 如果有未保存的更改，需要确认
    if (tab.isDirty) {
      // 这里应该显示确认对话框，暂时直接关闭
      console.warn(`File ${tab.name} has unsaved changes`);
    }
    
    fileTabs.value.splice(tabIndex, 1);
    
    // 如果关闭的是当前活动标签页，切换到其他标签页
    if (activeTabId.value === tabId) {
      if (fileTabs.value.length > 0) {
        const newActiveIndex = Math.min(tabIndex, fileTabs.value.length - 1);
        activeTabId.value = fileTabs.value[newActiveIndex]?.id || null;
      } else {
        activeTabId.value = null;
      }
    }
  };
  
  const switchToTab = (tabId: string) => {
    const tab = fileTabs.value.find(t => t.id === tabId);
    if (tab) {
      activeTabId.value = tabId;
    }
  };
  
  const updateTabContent = (tabId: string, content: string) => {
    const tab = fileTabs.value.find(t => t.id === tabId);
    if (tab) {
      const wasClean = !tab.isDirty;
      tab.content = content;
      tab.isDirty = true;
      
      // 如果启用了自动保存
      if (editorConfig.value.autoSave === 'afterDelay' && wasClean) {
        setTimeout(() => {
          saveFile(tabId);
        }, editorConfig.value.autoSaveDelay);
      }
    }
  };
  
  const markTabClean = (tabId: string) => {
    const tab = fileTabs.value.find(t => t.id === tabId);
    if (tab) {
      tab.isDirty = false;
    }
  };
  
  // 文件操作
  const saveFile = async (tabId: string) => {
    const tab = fileTabs.value.find(t => t.id === tabId);
    if (!tab || !context.value) return false;
    
    try {
      const { execute } = fileContent();
      await execute({
        params: {
          daemonId: context.value.daemonId,
          uuid: context.value.instanceUuid
        },
        data: {
          target: tab.path,
          text: tab.content
        }
      });
      
      markTabClean(tabId);
      return true;
    } catch (error) {
      console.error('Failed to save file:', error);
      return false;
    }
  };
  
  const saveAllFiles = async () => {
    const savePromises = dirtyTabs.value.map(tab => saveFile(tab.id));
    const results = await Promise.all(savePromises);
    return results.every(result => result);
  };
  
  // 文件树操作
  const loadFileTree = async (path: string = '/') => {
    if (!context.value) return;
    
    try {
      // 这里应该调用实际的文件列表API
      console.log(`Loading file tree: ${path}`);
      
      // 模拟文件树数据
      const mockFileTree: FileTreeNode[] = [
        {
          name: 'src',
          path: '/src',
          type: 'directory',
          children: [
            { name: 'main.js', path: '/src/main.js', type: 'file', size: 1024 },
            { name: 'config.json', path: '/src/config.json', type: 'file', size: 512 }
          ]
        },
        { name: 'README.md', path: '/README.md', type: 'file', size: 2048 }
      ];
      
      fileTree.value = mockFileTree;
    } catch (error) {
      console.error('Failed to load file tree:', error);
    }
  };
  
  const toggleFolder = (folderPath: string) => {
    if (expandedFolders.value.has(folderPath)) {
      expandedFolders.value.delete(folderPath);
    } else {
      expandedFolders.value.add(folderPath);
    }
  };
  
  // 编辑器配置
  const loadEditorConfig = () => {
    // 从本地存储或API加载配置
    const savedConfig = localStorage.getItem('vscode-editor-config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        editorConfig.value = { ...editorConfig.value, ...config };
      } catch (error) {
        console.error('Failed to load editor config:', error);
      }
    }
  };
  
  const saveEditorConfig = () => {
    localStorage.setItem('vscode-editor-config', JSON.stringify(editorConfig.value));
  };
  
  const updateEditorConfig = (config: Partial<EditorConfig>) => {
    editorConfig.value = { ...editorConfig.value, ...config };
    saveEditorConfig();
    
    // 应用到Monaco编辑器
    if (monacoEditor.value) {
      monacoEditor.value.updateOptions({
        fontSize: editorConfig.value.fontSize,
        lineHeight: editorConfig.value.lineHeight,
        tabSize: editorConfig.value.tabSize,
        insertSpaces: editorConfig.value.insertSpaces,
        wordWrap: editorConfig.value.wordWrap,
        minimap: { enabled: editorConfig.value.minimap },
        lineNumbers: editorConfig.value.lineNumbers
      });
    }
  };
  
  // Monaco编辑器管理
  const setMonacoEditor = (editor: editor.IStandaloneCodeEditor) => {
    monacoEditor.value = editor;
  };
  
  // 设置文件树
  const setFileTree = (nodes: FileTreeNode[]) => {
    fileTree.value = nodes;
  };

  // 关闭所有标签页
  const closeAllTabs = () => {
    fileTabs.value = [];
    activeTabId.value = null;
  };

  // 重新排序标签页
  const reorderTabs = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= fileTabs.value.length || targetIndex >= fileTabs.value.length) {
      return;
    }
    
    const [movedTab] = fileTabs.value.splice(sourceIndex, 1);
    fileTabs.value.splice(targetIndex, 0, movedTab);
  };
  
  // 主题管理
  const setTheme = (theme: 'dark' | 'light') => {
    currentTheme.value = theme;
    const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs-light';
    editorConfig.value.theme = monacoTheme;
    
    if (monacoEditor.value) {
      // 动态切换Monaco编辑器主题
      import('monaco-editor').then(monaco => {
        monaco.editor.setTheme(monacoTheme);
      });
    }
    
    // 保存主题设置
    localStorage.setItem('vscode-theme', theme);
  };
  
  // 加载主题设置
  const loadTheme = () => {
    const savedTheme = localStorage.getItem('vscode-theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  };
  
  // 搜索功能
  const toggleSearch = () => {
    searchState.value.isSearchVisible = !searchState.value.isSearchVisible;
  };
  
  const performSearch = (query: string, options?: { matchCase?: boolean; wholeWord?: boolean; useRegex?: boolean }) => {
    if (!monacoEditor.value || !query) return [];
    
    const model = monacoEditor.value.getModel();
    if (!model) return [];
    
    try {
      const searchOptions = {
        matchCase: options?.matchCase ?? searchState.value.matchCase,
        wholeWord: options?.wholeWord ?? searchState.value.wholeWord,
        isRegex: options?.useRegex ?? searchState.value.useRegex
      };
      
      const matches = model.findMatches(
        query,
        true,
        searchOptions.isRegex,
        searchOptions.matchCase,
        searchOptions.wholeWord ? query : null,
        true
      );
      
      searchState.value.searchResults = matches;
      searchState.value.currentResultIndex = 0;
      
      return matches;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  };
  
  const replaceText = (searchText: string, replaceText: string, replaceAll: boolean = false) => {
    if (!monacoEditor.value) return false;
    
    try {
      if (replaceAll) {
        const matches = performSearch(searchText);
        if (matches.length === 0) return false;
        
        const edits = matches.map(match => ({
          range: match.range,
          text: replaceText
        }));
        
        monacoEditor.value.executeEdits('replaceAll', edits);
      } else {
        const selection = monacoEditor.value.getSelection();
        if (selection) {
          monacoEditor.value.executeEdits('replace', [{
            range: selection,
            text: replaceText
          }]);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Replace error:', error);
      return false;
    }
  };
  
  // 快捷键管理
  const registerShortcut = (key: string, callback: () => void) => {
    keyboardShortcuts.value.set(key, callback);
  };
  
  const unregisterShortcut = (key: string) => {
    keyboardShortcuts.value.delete(key);
  };
  
  const handleKeyboardShortcut = (event: KeyboardEvent) => {
    const key = `${event.ctrlKey ? 'Ctrl+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.altKey ? 'Alt+' : ''}${event.key}`;
    const callback = keyboardShortcuts.value.get(key);
    if (callback) {
      event.preventDefault();
      callback();
    }
  };
  
  // 初始化快捷键
  const initializeShortcuts = () => {
    // Ctrl+S: 保存文件
    registerShortcut('Ctrl+s', () => {
      if (activeTab.value) {
        saveFile(activeTab.value.id);
      }
    });
    
    // Ctrl+F: 打开搜索
    registerShortcut('Ctrl+f', () => {
      toggleSearch();
    });
    
    // Ctrl+Shift+F: 在文件中搜索
    registerShortcut('Ctrl+Shift+f', () => {
      // 实现文件搜索功能
      console.log('Search in files');
    });
    
    // Ctrl+W: 关闭当前标签页
    registerShortcut('Ctrl+w', () => {
      if (activeTab.value) {
        closeFile(activeTab.value.id);
      }
    });
    
    // Ctrl+Shift+W: 关闭所有标签页
    registerShortcut('Ctrl+Shift+w', () => {
      closeAllTabs();
    });
    
    // Ctrl+Z: 撤销
    registerShortcut('Ctrl+z', () => {
      if (monacoEditor.value) {
        monacoEditor.value.trigger('keyboard', 'undo', null);
      }
    });
    
    // Ctrl+Y: 重做
    registerShortcut('Ctrl+y', () => {
      if (monacoEditor.value) {
        monacoEditor.value.trigger('keyboard', 'redo', null);
      }
    });
  };
  
  // 代码格式化
  const formatCode = async () => {
    if (!monacoEditor.value) return false;
    
    try {
      await monacoEditor.value.getAction('editor.action.formatDocument')?.run();
      return true;
    } catch (error) {
      console.error('Format error:', error);
      return false;
    }
  };
  
  // 代码折叠
  const foldAll = () => {
    if (monacoEditor.value) {
      monacoEditor.value.getAction('editor.foldAll')?.run();
    }
  };
  
  const unfoldAll = () => {
    if (monacoEditor.value) {
      monacoEditor.value.getAction('editor.unfoldAll')?.run();
    }
  };
  
  // 刷新文件树
  const refreshFileTree = async () => {
    await loadFileTree();
  };
  
  // 获取编辑器实例
  const getEditor = () => {
    return monacoEditor.value;
  };
  
  // 文件导航增强
  const navigateToLine = (line: number, column?: number) => {
    // 跳转到指定位置的逻辑
    if (line && monacoEditor.value) {
      setTimeout(() => {
        monacoEditor.value?.revealLineInCenter(line);
        if (column) {
          monacoEditor.value?.setPosition({ lineNumber: line, column });
        }
      }, 100);
    }
  };

  return {
    // 状态
    context,
    isInitialized,
    fileTabs,
    activeTabId,
    fileTree,
    expandedFolders,
    selectedFile,
    editorConfig,
    monacoEditor,
    
    // 计算属性
    activeTab,
    dirtyTabs,
    hasUnsavedChanges,
    
    // 方法
    initialize,
    cleanup,
    openFile,
    closeFile,
    switchToTab,
    updateTabContent,
    markTabClean,
    saveFile,
    saveAllFiles,
    loadFileTree,
    setFileTree,
    toggleFolder,
    loadEditorConfig,
    saveEditorConfig,
    updateEditorConfig,
    setMonacoEditor,
    closeAllTabs,
    reorderTabs,
    
    // 主题管理
    currentTheme,
    setTheme,
    loadTheme,
    
    // 搜索功能
    searchState,
    toggleSearch,
    performSearch,
    replaceText,
    
    // 快捷键管理
    keyboardShortcuts,
    registerShortcut,
    unregisterShortcut,
    handleKeyboardShortcut,
    initializeShortcuts,
    
    // 编辑器增强功能
    formatCode,
    foldAll,
    unfoldAll,
    refreshFileTree,
    getEditor,
    navigateToLine
  };
});