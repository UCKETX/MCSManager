<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { SettingOutlined, BugOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons-vue';
import { useVSCodeStore } from '@/stores/useVSCodeStore';
import { message } from 'ant-design-vue';

interface Props {
  daemonId: string;
  instanceUuid: string;
}

defineProps<Props>();

const vscodeStore = useVSCodeStore();
const currentTime = ref(new Date());

// 更新时间
setInterval(() => {
  currentTime.value = new Date();
}, 1000);

// 计算状态信息
const activeTab = computed(() => vscodeStore.activeTab);
const totalTabs = computed(() => vscodeStore.fileTabs.length);
const dirtyTabs = computed(() => vscodeStore.dirtyTabs.length);
const editorConfig = computed(() => vscodeStore.editorConfig);

// 获取文件编码
const getFileEncoding = (filename?: string) => {
  if (!filename) return 'UTF-8';
  
  // 根据文件扩展名推断编码
  const ext = filename.split('.').pop()?.toLowerCase();
  const encodingMap: Record<string, string> = {
    'txt': 'UTF-8',
    'log': 'UTF-8',
    'json': 'UTF-8',
    'js': 'UTF-8',
    'ts': 'UTF-8',
    'vue': 'UTF-8',
    'html': 'UTF-8',
    'css': 'UTF-8',
    'md': 'UTF-8',
    'py': 'UTF-8',
    'java': 'UTF-8',
    'cpp': 'UTF-8',
    'c': 'UTF-8',
    'h': 'UTF-8'
  };
  
  return encodingMap[ext || ''] || 'UTF-8';
};

// 获取文件语言
const getFileLanguage = (filename?: string) => {
  if (!filename) return 'Plain Text';
  
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'js': 'JavaScript',
    'jsx': 'JavaScript React',
    'ts': 'TypeScript',
    'tsx': 'TypeScript React',
    'vue': 'Vue',
    'py': 'Python',
    'json': 'JSON',
    'html': 'HTML',
    'htm': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'sass': 'Sass',
    'less': 'Less',
    'xml': 'XML',
    'yml': 'YAML',
    'yaml': 'YAML',
    'md': 'Markdown',
    'sh': 'Shell Script',
    'bash': 'Bash',
    'sql': 'SQL',
    'php': 'PHP',
    'java': 'Java',
    'c': 'C',
    'cpp': 'C++',
    'h': 'C Header',
    'hpp': 'C++ Header',
    'go': 'Go',
    'rs': 'Rust',
    'dockerfile': 'Dockerfile',
    'properties': 'Properties',
    'ini': 'INI',
    'conf': 'Configuration',
    'log': 'Log File',
    'txt': 'Plain Text'
  };
  
  return languageMap[ext || ''] || 'Plain Text';
};

// 获取文件大小格式化字符串
const getFormattedFileSize = (size?: number) => {
  if (!size) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let fileSize = size;
  
  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024;
    unitIndex++;
  }
  
  return `${fileSize.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

// 获取行列信息
const getCursorInfo = () => {
  if (!activeTab.value?.cursorPosition) {
    return 'Ln 1, Col 1';
  }
  
  const { line, column } = activeTab.value.cursorPosition;
  return `Ln ${line}, Col ${column}`;
};

// 获取选择信息
const getSelectionInfo = () => {
  // 这里可以从Monaco编辑器获取选择信息
  // 暂时返回空字符串
  return '';
};

// 获取缩进信息
const getIndentInfo = () => {
  const { tabSize, insertSpaces } = editorConfig.value;
  return insertSpaces ? `Spaces: ${tabSize}` : `Tab Size: ${tabSize}`;
};

// 获取行尾序列
const getLineEndingInfo = () => {
  // 根据操作系统返回默认行尾序列
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) {
    return 'CRLF';
  }
  return 'LF';
};

// 切换缩进模式
const toggleIndentMode = () => {
  vscodeStore.updateEditorConfig({
    insertSpaces: !editorConfig.value.insertSpaces
  });
  
  const mode = editorConfig.value.insertSpaces ? '空格' : '制表符';
  message.success(`已切换到${mode}缩进`);
};

// 更改缩进大小
const changeIndentSize = () => {
  const sizes = [2, 4, 8];
  const currentIndex = sizes.indexOf(editorConfig.value.tabSize);
  const nextIndex = (currentIndex + 1) % sizes.length;
  
  vscodeStore.updateEditorConfig({
    tabSize: sizes[nextIndex]
  });
  
  message.success(`缩进大小已设置为 ${sizes[nextIndex]}`);
};

// 切换行尾序列
const toggleLineEnding = () => {
  // 这里可以实现行尾序列切换逻辑
  message.info('行尾序列切换功能待实现');
};

// 切换编码
const toggleEncoding = () => {
  // 这里可以实现编码切换逻辑
  message.info('编码切换功能待实现');
};

// 打开设置
const openSettings = () => {
  // 这里可以打开设置页面
  message.info('设置页面待实现');
};

// 问题和警告统计（模拟数据）
const problemsCount = ref({ errors: 0, warnings: 0, infos: 0 });

// 监听活动标签页变化，更新问题统计
watch(activeTab, (newTab) => {
  if (newTab) {
    // 这里可以实现语法检查和问题统计
    // 暂时使用模拟数据
    problemsCount.value = {
      errors: Math.floor(Math.random() * 3),
      warnings: Math.floor(Math.random() * 5),
      infos: Math.floor(Math.random() * 2)
    };
  } else {
    problemsCount.value = { errors: 0, warnings: 0, infos: 0 };
  }
});
</script>

<template>
  <div class="status-bar">
    <!-- 左侧信息 -->
    <div class="status-left">
      <!-- 问题统计 -->
      <div 
        v-if="problemsCount.errors > 0 || problemsCount.warnings > 0"
        class="status-item problems"
        title="问题"
      >
        <BugOutlined v-if="problemsCount.errors > 0" class="error-icon" />
        <span v-if="problemsCount.errors > 0" class="error-count">{{ problemsCount.errors }}</span>
        
        <WarningOutlined v-if="problemsCount.warnings > 0" class="warning-icon" />
        <span v-if="problemsCount.warnings > 0" class="warning-count">{{ problemsCount.warnings }}</span>
        
        <InfoCircleOutlined v-if="problemsCount.infos > 0" class="info-icon" />
        <span v-if="problemsCount.infos > 0" class="info-count">{{ problemsCount.infos }}</span>
      </div>
      
      <!-- 文件统计 -->
      <div class="status-item" title="打开的文件">
        <span>{{ totalTabs }} 个文件</span>
        <span v-if="dirtyTabs > 0" class="dirty-indicator">({{ dirtyTabs }} 未保存)</span>
      </div>
    </div>
    
    <!-- 中间信息 -->
    <div class="status-center">
      <!-- 当前时间 -->
      <div class="status-item time">
        {{ currentTime.toLocaleTimeString() }}
      </div>
    </div>
    
    <!-- 右侧信息 -->
    <div class="status-right">
      <!-- 光标位置 -->
      <div v-if="activeTab" class="status-item cursor-info" title="行号, 列号">
        {{ getCursorInfo() }}
      </div>
      
      <!-- 选择信息 -->
      <div v-if="activeTab && getSelectionInfo()" class="status-item selection-info">
        {{ getSelectionInfo() }}
      </div>
      
      <!-- 缩进信息 -->
      <div 
        v-if="activeTab"
        class="status-item indent-info clickable"
        title="点击切换缩进模式"
        @click="toggleIndentMode"
      >
        {{ getIndentInfo() }}
      </div>
      
      <!-- 行尾序列 -->
      <div 
        v-if="activeTab"
        class="status-item line-ending clickable"
        title="点击切换行尾序列"
        @click="toggleLineEnding"
      >
        {{ getLineEndingInfo() }}
      </div>
      
      <!-- 文件编码 -->
      <div 
        v-if="activeTab"
        class="status-item encoding clickable"
        title="点击切换编码"
        @click="toggleEncoding"
      >
        {{ getFileEncoding(activeTab.name) }}
      </div>
      
      <!-- 文件语言 -->
      <div v-if="activeTab" class="status-item language" title="文件语言">
        {{ getFileLanguage(activeTab.name) }}
      </div>
      
      <!-- 文件大小 -->
      <div v-if="activeTab" class="status-item file-size" title="文件大小">
        {{ getFormattedFileSize(activeTab.content.length) }}
      </div>
      
      <!-- 设置按钮 -->
      <div 
        class="status-item settings clickable"
        title="打开设置"
        @click="openSettings"
      >
        <SettingOutlined />
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  background: #007acc;
  color: #ffffff;
  font-size: 12px;
  line-height: 22px;
  padding: 0 8px;
  user-select: none;
  
  .status-left,
  .status-center,
  .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .status-center {
    flex: 1;
    justify-content: center;
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
    height: 22px;
    white-space: nowrap;
    
    &.clickable {
      cursor: pointer;
      transition: background-color 0.2s;
      
      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
    
    &.problems {
      gap: 6px;
      
      .error-icon {
        color: #f48771;
      }
      
      .warning-icon {
        color: #ffcc02;
      }
      
      .info-icon {
        color: #75beff;
      }
      
      .error-count,
      .warning-count,
      .info-count {
        font-weight: 500;
      }
    }
    
    .dirty-indicator {
      color: #ffcc02;
      font-weight: 500;
    }
    
    &.time {
      font-family: 'Courier New', monospace;
      color: rgba(255, 255, 255, 0.8);
    }
    
    &.cursor-info {
      font-family: 'Courier New', monospace;
      min-width: 80px;
    }
    
    &.selection-info {
      color: #ffcc02;
      font-weight: 500;
    }
    
    &.indent-info {
      min-width: 70px;
    }
    
    &.line-ending {
      min-width: 40px;
    }
    
    &.encoding {
      min-width: 50px;
    }
    
    &.language {
      color: rgba(255, 255, 255, 0.9);
      font-weight: 500;
    }
    
    &.file-size {
      color: rgba(255, 255, 255, 0.8);
      font-family: 'Courier New', monospace;
    }
    
    &.settings {
      :deep(.anticon) {
        font-size: 14px;
      }
    }
  }
}

// 响应式设计
@media (max-width: 1200px) {
  .status-bar {
    .status-item {
      &.file-size,
      &.time {
        display: none;
      }
    }
  }
}

@media (max-width: 900px) {
  .status-bar {
    .status-item {
      &.encoding,
      &.line-ending {
        display: none;
      }
    }
  }
}

@media (max-width: 600px) {
  .status-bar {
    .status-center {
      display: none;
    }
    
    .status-item {
      &.language,
      &.indent-info {
        display: none;
      }
    }
  }
}
</style>