<template>
  <div class="search-panel-content">
    <!-- 搜索输入区域 -->
    <div class="search-section">
      <div class="search-input-group">
        <a-input
          v-model:value="searchQuery"
          placeholder="搜索"
          class="search-input"
          @keyup.enter="performSearch"
          @input="onSearchInput"
        >
          <template #suffix>
            <div class="search-actions">
              <a-button 
                type="text" 
                size="small" 
                title="区分大小写"
                :class="{ active: matchCase }"
                @click="toggleMatchCase"
                class="search-option-btn"
              >
                Aa
              </a-button>
              <a-button 
                type="text" 
                size="small" 
                title="全字匹配"
                :class="{ active: wholeWord }"
                @click="toggleWholeWord"
                class="search-option-btn"
              >
                Ab
              </a-button>
              <a-button 
                type="text" 
                size="small" 
                title="使用正则表达式"
                :class="{ active: useRegex }"
                @click="toggleRegex"
                class="search-option-btn"
              >
                .*
              </a-button>
            </div>
          </template>
        </a-input>
      </div>
      
      <!-- 搜索导航 -->
      <div class="search-navigation" v-if="searchResults.length > 0">
        <span class="search-count">{{ currentResultIndex + 1 }} / {{ searchResults.length }}</span>
        <div class="nav-buttons">
          <a-button 
            type="text" 
            size="small" 
            title="上一个结果"
            @click="previousResult"
            :disabled="searchResults.length === 0"
            class="nav-btn"
          >
            ↑
          </a-button>
          <a-button 
            type="text" 
            size="small" 
            title="下一个结果"
            @click="nextResult"
            :disabled="searchResults.length === 0"
            class="nav-btn"
          >
            ↓
          </a-button>
        </div>
      </div>
    </div>

    <!-- 替换输入区域 -->
    <div class="replace-section" v-if="showReplace">
      <div class="replace-input-group">
        <a-input
          v-model:value="replaceQuery"
          placeholder="替换"
          class="replace-input"
          @keyup.enter="replaceNext"
        >
          <template #suffix>
            <div class="replace-actions">
              <a-button 
                type="text" 
                size="small" 
                title="替换"
                @click="replaceNext"
                :disabled="searchResults.length === 0"
                class="replace-btn"
              >
                ⤴
              </a-button>
              <a-button 
                type="text" 
                size="small" 
                title="全部替换"
                @click="replaceAll"
                :disabled="searchResults.length === 0"
                class="replace-btn"
              >
                ⤴⤴
              </a-button>
            </div>
          </template>
        </a-input>
      </div>
    </div>

    <!-- 搜索选项 -->
    <div class="search-options">
      <a-button 
        type="text" 
        size="small" 
        @click="toggleReplace"
        :title="showReplace ? '隐藏替换' : '显示替换'"
        class="option-btn"
      >
        <template #icon>
          <i class="codicon codicon-replace"></i>
        </template>
      </a-button>
      
      <a-button 
        type="text" 
        size="small" 
        title="在文件中搜索"
        @click="searchInFiles"
        class="option-btn"
      >
        <template #icon>
          <i class="codicon codicon-search"></i>
        </template>
      </a-button>
    </div>

    <!-- 搜索结果列表 -->
    <div class="search-results" v-if="fileSearchResults.length > 0">
      <div class="results-header">
        <span class="results-count">{{ fileSearchResults.length }} 个结果</span>
        <a-button 
          type="text" 
          size="small" 
          title="清除结果"
          @click="clearResults"
          class="clear-btn"
        >
          ×
        </a-button>
      </div>
      
      <div class="results-list">
        <div 
          v-for="(result, index) in fileSearchResults" 
          :key="index"
          class="result-item"
          @click="openSearchResult(result)"
        >
          <div class="result-file">
            <i class="codicon codicon-file"></i>
            <span class="file-name">{{ result.fileName }}</span>
            <span class="match-count">({{ result.matches.length }})</span>
          </div>
          
          <div class="result-matches">
            <div 
              v-for="(match, matchIndex) in result.matches.slice(0, 5)" 
              :key="matchIndex"
              class="match-item"
              @click.stop="openMatch(result, match)"
            >
              <span class="line-number">{{ match.line }}</span>
              <span class="match-text" v-html="highlightMatch(match.text, searchQuery)"></span>
            </div>
            <div v-if="result.matches.length > 5" class="more-matches">
              +{{ result.matches.length - 5 }} 更多匹配
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useVSCodeStore } from '@/stores/useVSCodeStore';

interface Props {
  daemonId: string;
  instanceUuid: string;
}

interface SearchMatch {
  line: number;
  column: number;
  text: string;
  length: number;
}

interface FileSearchResult {
  fileName: string;
  filePath: string;
  matches: SearchMatch[];
}

const props = defineProps<Props>();
const vscodeStore = useVSCodeStore();

// 搜索状态
const searchQuery = ref('');
const replaceQuery = ref('');
const showReplace = ref(false);
const matchCase = ref(false);
const wholeWord = ref(false);
const useRegex = ref(false);

// 搜索结果
const searchResults = ref<any[]>([]);
const currentResultIndex = ref(0);
const fileSearchResults = ref<FileSearchResult[]>([]);

// 切换选项
const toggleReplace = () => {
  showReplace.value = !showReplace.value;
};

const toggleMatchCase = () => {
  matchCase.value = !matchCase.value;
  if (searchQuery.value) {
    performSearch();
  }
};

const toggleWholeWord = () => {
  wholeWord.value = !wholeWord.value;
  if (searchQuery.value) {
    performSearch();
  }
};

const toggleRegex = () => {
  useRegex.value = !useRegex.value;
  if (searchQuery.value) {
    performSearch();
  }
};

// 搜索功能
const onSearchInput = () => {
  if (searchQuery.value.length > 0) {
    performSearch();
  } else {
    clearCurrentSearch();
  }
};

const performSearch = () => {
  if (!searchQuery.value || !vscodeStore.activeTab) return;
  
  try {
    const editor = vscodeStore.getEditor();
    if (!editor) return;
    
    const model = editor.getModel();
    if (!model) return;
    
    let searchOptions = {
      matchCase: matchCase.value,
      wholeWord: wholeWord.value,
      isRegex: useRegex.value
    };
    
    const matches = model.findMatches(
      searchQuery.value,
      true, // searchOnlyEditableRange
      useRegex.value,
      matchCase.value,
      wholeWord.value ? searchQuery.value : null,
      true // captureMatches
    );
    
    searchResults.value = matches;
    currentResultIndex.value = 0;
    
    if (matches.length > 0) {
      highlightCurrentResult();
    }
  } catch (error) {
    console.error('搜索错误:', error);
  }
};

const clearCurrentSearch = () => {
  searchResults.value = [];
  currentResultIndex.value = 0;
  
  const editor = vscodeStore.getEditor();
  if (editor) {
    editor.deltaDecorations([], []);
  }
};

const highlightCurrentResult = () => {
  const editor = vscodeStore.getEditor();
  if (!editor || searchResults.value.length === 0) return;
  
  const currentMatch = searchResults.value[currentResultIndex.value];
  if (!currentMatch) return;
  
  // 高亮当前结果
  const decorations = searchResults.value.map((match, index) => ({
    range: match.range,
    options: {
      className: index === currentResultIndex.value ? 'current-search-match' : 'search-match',
      stickiness: 1
    }
  }));
  
  editor.deltaDecorations([], decorations);
  editor.revealRangeInCenter(currentMatch.range);
  editor.setSelection(currentMatch.range);
};

// 导航功能
const nextResult = () => {
  if (searchResults.value.length === 0) return;
  
  currentResultIndex.value = (currentResultIndex.value + 1) % searchResults.value.length;
  highlightCurrentResult();
};

const previousResult = () => {
  if (searchResults.value.length === 0) return;
  
  currentResultIndex.value = currentResultIndex.value === 0 
    ? searchResults.value.length - 1 
    : currentResultIndex.value - 1;
  highlightCurrentResult();
};

// 替换功能
const replaceNext = () => {
  if (!replaceQuery.value || searchResults.value.length === 0) return;
  
  const editor = vscodeStore.getEditor();
  if (!editor) return;
  
  const currentMatch = searchResults.value[currentResultIndex.value];
  if (!currentMatch) return;
  
  editor.executeEdits('replace', [{
    range: currentMatch.range,
    text: replaceQuery.value
  }]);
  
  // 重新搜索以更新结果
  setTimeout(() => {
    performSearch();
  }, 100);
};

const replaceAll = () => {
  if (!replaceQuery.value || searchResults.value.length === 0) return;
  
  const editor = vscodeStore.getEditor();
  if (!editor) return;
  
  const edits = searchResults.value.map(match => ({
    range: match.range,
    text: replaceQuery.value
  }));
  
  editor.executeEdits('replaceAll', edits);
  
  // 清除搜索结果
  setTimeout(() => {
    clearCurrentSearch();
  }, 100);
};

// 文件搜索功能
const searchInFiles = async () => {
  if (!searchQuery.value) return;
  
  try {
    // 这里应该调用后端API进行文件搜索
    // 暂时使用模拟数据
    fileSearchResults.value = [
      {
        fileName: 'example.js',
        filePath: '/path/to/example.js',
        matches: [
          { line: 10, column: 5, text: `console.log('${searchQuery.value}');`, length: searchQuery.value.length },
          { line: 25, column: 12, text: `const ${searchQuery.value} = 'value';`, length: searchQuery.value.length }
        ]
      }
    ];
  } catch (error) {
    console.error('文件搜索错误:', error);
  }
};

const clearResults = () => {
  fileSearchResults.value = [];
};

const openSearchResult = (result: FileSearchResult) => {
  // 打开文件
  const fileName = result.filePath.split('/').pop() || 'untitled';
  vscodeStore.openFile(result.filePath, fileName);
};

const openMatch = (result: FileSearchResult, match: SearchMatch) => {
  // 打开文件并跳转到指定行
  const fileName = result.filePath.split('/').pop() || 'untitled';
  const tab = vscodeStore.openFile(result.filePath, fileName);
  // 跳转到指定行列
  if (tab && vscodeStore.monacoEditor) {
    vscodeStore.navigateToLine(match.line, match.column);
  }
};

const highlightMatch = (text: string, query: string) => {
  if (!query) return text;
  
  const regex = new RegExp(`(${query})`, matchCase.value ? 'g' : 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};

// 监听搜索查询变化
watch(searchQuery, (newValue) => {
  if (!newValue) {
    clearCurrentSearch();
    clearResults();
  }
});
</script>

<style lang="less" scoped>
.search-panel-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  gap: 8px;
  font-size: 13px;
}

.search-section {
  .search-input-group {
    position: relative;
    
    .search-input {
      :deep(.ant-input) {
        padding-right: 80px;
        font-size: 13px;
        
        .theme-dark & {
          background: #3c3c3c;
          border-color: #464647;
          color: #cccccc;
          
          &:focus {
            border-color: #007acc;
            box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
          }
        }
        
        .theme-light & {
          background: #ffffff;
          border-color: #d0d0d0;
          color: #333333;
          
          &:focus {
            border-color: #007acc;
            box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
          }
        }
      }
    }
    
    .search-actions {
      display: flex;
      gap: 2px;
      
      .search-option-btn {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        border-radius: 2px;
        
        &.active {
          .theme-dark & {
            background: #007acc;
            color: #ffffff;
          }
          
          .theme-light & {
            background: #007acc;
            color: #ffffff;
          }
        }
      }
    }
  }
  
  .search-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
    
    .search-count {
      font-size: 11px;
      opacity: 0.8;
    }
    
    .nav-buttons {
      display: flex;
      gap: 2px;
      
      .nav-btn {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        border-radius: 2px;
      }
    }
  }
}

.replace-section {
  .replace-input-group {
    position: relative;
    
    .replace-input {
      :deep(.ant-input) {
        padding-right: 60px;
        font-size: 13px;
        
        .theme-dark & {
          background: #3c3c3c;
          border-color: #464647;
          color: #cccccc;
        }
        
        .theme-light & {
          background: #ffffff;
          border-color: #d0d0d0;
          color: #333333;
        }
      }
    }
    
    .replace-actions {
      display: flex;
      gap: 2px;
      
      .replace-btn {
        width: 24px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        border-radius: 2px;
      }
    }
  }
}

.search-options {
  display: flex;
  gap: 4px;
  
  .option-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    
    .codicon {
      font-size: 14px;
    }
  }
}

.search-results {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  
  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid;
    
    .theme-dark & {
      border-color: #3c3c3c;
    }
    
    .theme-light & {
      border-color: #e5e5e5;
    }
    
    .results-count {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.8;
    }
    
    .clear-btn {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border-radius: 2px;
    }
  }
  
  .results-list {
    flex: 1;
    overflow-y: auto;
    
    .result-item {
      margin: 4px 0;
      cursor: pointer;
      border-radius: 4px;
      
      .theme-dark & {
        &:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      }
      
      .theme-light & {
        &:hover {
          background: rgba(0, 0, 0, 0.03);
        }
      }
      
      .result-file {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        font-weight: 500;
        
        .codicon {
          font-size: 14px;
          opacity: 0.8;
        }
        
        .file-name {
          flex: 1;
          font-size: 12px;
        }
        
        .match-count {
          font-size: 11px;
          opacity: 0.6;
        }
      }
      
      .result-matches {
        .match-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 2px 8px 2px 28px;
          font-size: 11px;
          cursor: pointer;
          
          .theme-dark & {
            &:hover {
              background: rgba(255, 255, 255, 0.08);
            }
          }
          
          .theme-light & {
            &:hover {
              background: rgba(0, 0, 0, 0.05);
            }
          }
          
          .line-number {
            min-width: 30px;
            text-align: right;
            opacity: 0.6;
            font-family: monospace;
          }
          
          .match-text {
            flex: 1;
            font-family: monospace;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            
            :deep(mark) {
              background: #f39c12;
              color: #000;
              padding: 0 1px;
              border-radius: 1px;
            }
          }
        }
        
        .more-matches {
          padding: 2px 8px 2px 28px;
          font-size: 11px;
          opacity: 0.6;
          font-style: italic;
        }
      }
    }
  }
}

// VSCode图标
.codicon {
  font-family: 'codicon';
  
  &.codicon-replace::before {
    content: '\eab2';
  }
  
  &.codicon-search::before {
    content: '\eab6';
  }
  
  &.codicon-file::before {
    content: '\ea7b';
  }
}

// 搜索匹配高亮样式
:deep(.search-match) {
  background: rgba(255, 255, 0, 0.3);
  border: 1px solid rgba(255, 255, 0, 0.6);
}

:deep(.current-search-match) {
  background: rgba(0, 122, 204, 0.3);
  border: 1px solid #007acc;
}
</style>