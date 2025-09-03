<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import * as monaco from 'monaco-editor';
import { message } from 'ant-design-vue';
import { useVSCodeStore } from '@/stores/useVSCodeStore';

interface Props {
  daemonId: string;
  instanceUuid: string;
}

defineProps<Props>();

const vscodeStore = useVSCodeStore();
const editorContainer = ref<HTMLElement>();
const isLoading = ref(false);

// Monaco编辑器实例
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

// 语言映射
const getLanguageFromExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'json': 'json',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'xml': 'xml',
    'yml': 'yaml',
    'yaml': 'yaml',
    'md': 'markdown',
    'sh': 'shell',
    'bash': 'shell',
    'sql': 'sql',
    'php': 'php',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'go': 'go',
    'rs': 'rust',
    'vue': 'html', // Vue文件使用HTML语法高亮
    'dockerfile': 'dockerfile',
    'properties': 'properties',
    'ini': 'ini',
    'conf': 'ini',
    'log': 'plaintext'
  };
  
  return languageMap[ext || ''] || 'plaintext';
};

// 初始化编辑器
const initializeEditor = () => {
  if (!editorContainer.value) return;
  
  // 定义自定义主题
  monaco.editor.defineTheme('vscode-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'regexp', foreground: 'D16969' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'class', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'constant', foreground: '4FC1FF' },
      { token: 'property', foreground: '9CDCFE' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'delimiter', foreground: 'D4D4D4' }
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editor.lineHighlightBackground': '#2d2d30',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41',
      'editorCursor.foreground': '#aeafad',
      'editorWhitespace.foreground': '#404040',
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',
      'editorGroupHeader.tabsBackground': '#2d2d2d',
      'tab.activeBackground': '#1e1e1e',
      'tab.inactiveBackground': '#2d2d2d',
      'tab.border': '#2d2d2d',
      'panel.background': '#1e1e1e',
      'sideBar.background': '#252526',
      'activityBar.background': '#333333'
    }
  });
  
  // 定义浅色主题
  monaco.editor.defineTheme('vscode-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000' },
      { token: 'keyword', foreground: '0000FF' },
      { token: 'string', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'regexp', foreground: 'D16969' },
      { token: 'type', foreground: '267F99' },
      { token: 'class', foreground: '267F99' },
      { token: 'function', foreground: '795E26' },
      { token: 'variable', foreground: '001080' },
      { token: 'constant', foreground: '0070C1' },
      { token: 'property', foreground: '001080' },
      { token: 'operator', foreground: '000000' },
      { token: 'delimiter', foreground: '000000' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editor.lineHighlightBackground': '#f0f0f0',
      'editor.selectionBackground': '#add6ff',
      'editor.inactiveSelectionBackground': '#e5ebf1',
      'editorCursor.foreground': '#000000',
      'editorWhitespace.foreground': '#bfbfbf',
      'editorIndentGuide.background': '#d3d3d3',
      'editorIndentGuide.activeBackground': '#939393',
      'editorGroupHeader.tabsBackground': '#f3f3f3',
      'tab.activeBackground': '#ffffff',
      'tab.inactiveBackground': '#ececec',
      'tab.border': '#c8c8c8',
      'panel.background': '#ffffff',
      'sideBar.background': '#f3f3f3',
      'activityBar.background': '#2c2c2c'
    }
  });
    
  // 创建编辑器实例
  editor = monaco.editor.create(editorContainer.value, {
    value: vscodeStore.activeTab?.content || '// 欢迎使用 VSCode 编辑器\n// 从左侧文件树选择文件开始编辑',
    language: vscodeStore.activeTab ? getLanguageFromExtension(vscodeStore.activeTab.name) : 'javascript',
    theme: vscodeStore.currentTheme === 'dark' ? 'vscode-dark' : 'vscode-light',
    fontSize: vscodeStore.editorConfig.fontSize,
    lineHeight: vscodeStore.editorConfig.lineHeight,
    tabSize: vscodeStore.editorConfig.tabSize,
    insertSpaces: vscodeStore.editorConfig.insertSpaces,
    wordWrap: vscodeStore.editorConfig.wordWrap,
    minimap: { enabled: vscodeStore.editorConfig.minimap },
    lineNumbers: vscodeStore.editorConfig.lineNumbers,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    renderWhitespace: 'selection',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    mouseWheelZoom: true,
    contextmenu: true,
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: true,
    parameterHints: { enabled: true },
    autoIndent: 'advanced',
    formatOnPaste: vscodeStore.editorConfig.formatOnPaste,
    formatOnType: true,
    dragAndDrop: true,
    links: true,
    colorDecorators: true,
    lightbulb: { enabled: true },
    // 新增功能配置
    folding: vscodeStore.editorConfig.codeFolding,
    foldingStrategy: 'indentation',
    showFoldingControls: 'always',
    foldingHighlight: true,
    unfoldOnClickAfterEndOfLine: true,
    matchBrackets: vscodeStore.editorConfig.bracketMatching ? 'always' : 'never',
    autoClosingBrackets: vscodeStore.editorConfig.autoClosingBrackets ? 'always' : 'never',
    autoClosingQuotes: vscodeStore.editorConfig.autoClosingQuotes ? 'always' : 'never',
    multiCursorModifier: 'ctrlCmd',
    selectionHighlight: true,
    occurrencesHighlight: true,
    codeLens: true,
    glyphMargin: true
  });
    
  try {
    // 保存编辑器实例到store
    vscodeStore.setMonacoEditor(editor);
    
    // 监听内容变化
  editor.onDidChangeModelContent(() => {
    if (vscodeStore.activeTab && editor) {
      const content = editor.getValue();
      vscodeStore.updateTabContent(vscodeStore.activeTab.id, content);
    }
  });
  
  // 监听光标位置变化
  editor.onDidChangeCursorPosition((e) => {
    if (vscodeStore.activeTab) {
      // 更新光标位置（如果store中有相关方法的话）
      // vscodeStore.updateTabCursorPosition 方法不存在，暂时注释
      // vscodeStore.updateTabCursorPosition(vscodeStore.activeTab.id, {
      //   line: e.position.lineNumber,
      //   column: e.position.column
      // });
    }
  });
  
  // 添加键盘快捷键
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    saveCurrentFile();
  });
  
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
    saveAllFiles();
  });
  
  // 搜索快捷键
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
    vscodeStore.toggleSearch();
  });
  
  // 格式化代码快捷键
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
    vscodeStore.formatCode();
  });
  
  // 代码折叠快捷键
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
    // 折叠所有代码
    editor?.getAction('editor.foldAll')?.run();
  });
  
  // 展开所有代码快捷键
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
    // 展开所有代码
    editor?.getAction('editor.unfoldAll')?.run();
  });
  
  // 关闭标签页快捷键
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
    if (vscodeStore.activeTab) {
      vscodeStore.closeFile(vscodeStore.activeTab.id);
    }
  });
  
  // 撤销/重做快捷键（Monaco自带，这里只是确保启用）
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
    if (editor) {
      editor.trigger('keyboard', 'undo', null);
    }
  });
  
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
    if (editor) {
      editor.trigger('keyboard', 'redo', null);
    }
  });
  
    // 配置代码补全提供者
    setupCodeCompletion();
  } catch (error) {
    console.error('Failed to initialize Monaco editor:', error);
    message.error('编辑器初始化失败');
  }
};

// 配置代码补全
const setupCodeCompletion = () => {
  // JavaScript/TypeScript 代码补全
  monaco.languages.registerCompletionItemProvider('javascript', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };
      
      const suggestions: monaco.languages.CompletionItem[] = [
        {
          label: 'console.log',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'console.log(${1:message});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Log a message to the console',
          range: range
        },
        {
          label: 'function',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'function ${1:name}(${2:params}) {\n\t${3:// body}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Function declaration',
          range: range
        },
        {
          label: 'if',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'if (${1:condition}) {\n\t${2:// body}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'If statement',
          range: range
        },
        {
          label: 'for',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t${3:// body}\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'For loop',
          range: range
        }
      ];
      
      return { suggestions };
    }
  });
  
  // Python 代码补全
  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };
      
      const suggestions: monaco.languages.CompletionItem[] = [
        {
          label: 'print',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'print(${1:message})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Print a message',
          range: range
        },
        {
          label: 'def',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'def ${1:function_name}(${2:params}):\n    ${3:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Function definition',
          range: range
        },
        {
          label: 'if',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'if ${1:condition}:\n    ${2:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'If statement',
          range: range
        },
        {
          label: 'for',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'for ${1:item} in ${2:iterable}:\n    ${3:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'For loop',
          range: range
        }
      ];
      
      return { suggestions };
    }
  });
};

// 保存当前文件
const saveCurrentFile = async () => {
  if (!vscodeStore.activeTab) return;
  
  isLoading.value = true;
  try {
    const success = await vscodeStore.saveFile(vscodeStore.activeTab.id);
    if (success) {
      message.success(`文件 ${vscodeStore.activeTab.name} 保存成功`);
    } else {
      message.error('文件保存失败');
    }
  } catch (error) {
    console.error('Save file error:', error);
    message.error('文件保存失败');
  } finally {
    isLoading.value = false;
  }
};

// 保存所有文件
const saveAllFiles = async () => {
  if (vscodeStore.dirtyTabs.length === 0) {
    message.info('没有需要保存的文件');
    return;
  }
  
  isLoading.value = true;
  try {
    const success = await vscodeStore.saveAllFiles();
    if (success) {
      message.success(`已保存 ${vscodeStore.dirtyTabs.length} 个文件`);
    } else {
      message.error('部分文件保存失败');
    }
  } catch (error) {
    console.error('Save all files error:', error);
    message.error('文件保存失败');
  } finally {
    isLoading.value = false;
  }
};

// 监听活动标签页变化
watch(
  () => vscodeStore.activeTab,
  (newTab, oldTab) => {
    if (!editor) return;
    
    if (newTab) {
      // 切换到新标签页
      const language = getLanguageFromExtension(newTab.name);
      const model = monaco.editor.createModel(newTab.content, language);
      editor.setModel(model);
      
      // 恢复光标位置
      if (newTab.cursorPosition) {
        editor.setPosition({
          lineNumber: newTab.cursorPosition.line,
          column: newTab.cursorPosition.column
        });
      }
      
      // 聚焦编辑器
      nextTick(() => {
        editor?.focus();
      });
    } else {
      // 没有活动标签页，显示欢迎页面
      const model = monaco.editor.createModel(
        '// 欢迎使用 VSCode 编辑器\n// 从左侧文件树选择文件开始编辑',
        'javascript'
      );
      editor.setModel(model);
    }
    
    // 清理旧模型
    if (oldTab && oldTab !== newTab) {
      const oldModel = editor.getModel();
      if (oldModel && oldModel !== editor.getModel()) {
        oldModel.dispose();
      }
    }
  },
  { immediate: true }
);

// 监听主题变化
watch(
  () => vscodeStore.currentTheme,
  (newTheme) => {
    if (!editor) return;
    monaco.editor.setTheme(newTheme === 'dark' ? 'vscode-dark' : 'vscode-light');
  }
);

// 监听编辑器配置变化
watch(
  () => vscodeStore.editorConfig,
  (newConfig) => {
    if (!editor) return;
    
    editor.updateOptions({
      fontSize: newConfig.fontSize,
      lineHeight: newConfig.lineHeight,
      tabSize: newConfig.tabSize,
      insertSpaces: newConfig.insertSpaces,
      wordWrap: newConfig.wordWrap,
      minimap: { enabled: newConfig.minimap },
      lineNumbers: newConfig.lineNumbers,
      formatOnPaste: newConfig.formatOnPaste,
      folding: newConfig.codeFolding,
      matchBrackets: newConfig.bracketMatching ? 'always' : 'never',
      autoClosingBrackets: newConfig.autoClosingBrackets ? 'always' : 'never',
      autoClosingQuotes: newConfig.autoClosingQuotes ? 'always' : 'never'
    });
  },
  { deep: true }
);

// 组件挂载
onMounted(() => {
  initializeEditor();
});

// 组件卸载
onUnmounted(() => {
  if (editor) {
    editor.dispose();
    editor = null;
  }
});
</script>

<template>
  <div class="monaco-editor-panel">
    <div 
      ref="editorContainer" 
      class="editor-container"
      :class="{ 'loading': isLoading }"
    />
    
    <!-- 加载指示器 -->
    <div v-if="isLoading" class="loading-overlay">
      <a-spin size="large" />
    </div>
    
    <!-- 空状态 -->
    <div v-if="!vscodeStore.activeTab" class="empty-state">
      <div class="empty-content">
        <h3>欢迎使用 VSCode 编辑器</h3>
        <p>从左侧文件树选择文件开始编辑</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.monaco-editor-panel {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 500px;
  background: #1e1e1e;
  
  .editor-container {
    width: 100%;
    height: 100%;
    
    &.loading {
      opacity: 0.6;
      pointer-events: none;
    }
  }
  
  .loading-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
  }
  
  .empty-state {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1e1e1e;
    color: #cccccc;
    
    .empty-content {
      text-align: center;
      
      h3 {
        color: #cccccc;
        margin-bottom: 8px;
        font-weight: 500;
      }
      
      p {
        color: #969696;
        margin: 0;
      }
    }
  }
}

// Monaco编辑器样式覆盖
:deep(.monaco-editor) {
  .margin {
    background-color: #1e1e1e;
  }
  
  .monaco-editor-background {
    background-color: #1e1e1e;
  }
  
  .current-line {
    background-color: #2d2d30;
  }
}
</style>