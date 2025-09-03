<script setup lang="ts" name="FileTreeNode">
import { 
  FolderOutlined, 
  FolderOpenOutlined, 
  FileOutlined,
  FileJpgOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileZipOutlined,
  FileTextOutlined,
  CodeOutlined,
  Html5Outlined,
  DatabaseOutlined,
  SettingOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  AudioOutlined
} from '@ant-design/icons-vue';
import { type FileTreeNode } from '@/stores/useVSCodeStore';

// 获取文件图标
const getFileIcon = (node: FileTreeNode) => {
  if (node.type === 'directory') {
    return node.isExpanded ? FolderOpenOutlined : FolderOutlined;
  }
  
  // 根据文件扩展名返回对应图标
  const ext = node.name.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, any> = {
    // 代码文件
    'js': CodeOutlined,
    'jsx': CodeOutlined,
    'ts': CodeOutlined,
    'tsx': CodeOutlined,
    'vue': CodeOutlined,
    'py': CodeOutlined,
    'java': CodeOutlined,
    'cpp': CodeOutlined,
    'c': CodeOutlined,
    'php': CodeOutlined,
    'go': CodeOutlined,
    'rs': CodeOutlined,
    'rb': CodeOutlined,
    'swift': CodeOutlined,
    'kt': CodeOutlined,
    
    // Web文件
    'html': Html5Outlined,
    'htm': Html5Outlined,
    'css': FileTextOutlined,
    'scss': FileTextOutlined,
    'less': FileTextOutlined,
    'sass': FileTextOutlined,
    
    // 数据文件
    'json': DatabaseOutlined,
    'xml': DatabaseOutlined,
    'yml': DatabaseOutlined,
    'yaml': DatabaseOutlined,
    'sql': DatabaseOutlined,
    'db': DatabaseOutlined,
    
    // 文档文件
    'md': FileTextOutlined,
    'txt': FileTextOutlined,
    'doc': FileWordOutlined,
    'docx': FileWordOutlined,
    'pdf': FilePdfOutlined,
    'xls': FileExcelOutlined,
    'xlsx': FileExcelOutlined,
    'ppt': FilePptOutlined,
    'pptx': FilePptOutlined,
    
    // 图片文件
    'jpg': FileImageOutlined,
    'jpeg': FileImageOutlined,
    'png': FileImageOutlined,
    'gif': FileImageOutlined,
    'svg': FileImageOutlined,
    'webp': FileImageOutlined,
    'ico': FileImageOutlined,
    'bmp': FileImageOutlined,
    
    // 视频文件
    'mp4': VideoCameraOutlined,
    'avi': VideoCameraOutlined,
    'mov': VideoCameraOutlined,
    'wmv': VideoCameraOutlined,
    'flv': VideoCameraOutlined,
    'webm': VideoCameraOutlined,
    
    // 音频文件
    'mp3': AudioOutlined,
    'wav': AudioOutlined,
    'flac': AudioOutlined,
    'aac': AudioOutlined,
    'ogg': AudioOutlined,
    
    // 压缩文件
    'zip': FileZipOutlined,
    'rar': FileZipOutlined,
    '7z': FileZipOutlined,
    'tar': FileZipOutlined,
    'gz': FileZipOutlined,
    
    // 配置文件
    'env': SettingOutlined,
    'config': SettingOutlined,
    'conf': SettingOutlined,
    'ini': SettingOutlined,
    'cfg': SettingOutlined,
    'properties': SettingOutlined,
    
    // Shell脚本
    'sh': FileTextOutlined,
    'bash': FileTextOutlined,
    'zsh': FileTextOutlined,
    'fish': FileTextOutlined,
    'bat': FileTextOutlined,
    'cmd': FileTextOutlined,
    'ps1': FileTextOutlined
  };
  
  return iconMap[ext || ''] || FileOutlined;
};

// 获取文件类型样式类
const getFileTypeClass = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'file-js',
    'jsx': 'file-js',
    'ts': 'file-ts',
    'tsx': 'file-ts',
    
    // 框架文件
    'vue': 'file-vue',
    'react': 'file-react',
    'angular': 'file-angular',
    
    // 编程语言
    'py': 'file-python',
    'java': 'file-java',
    'cpp': 'file-cpp',
    'c': 'file-c',
    'php': 'file-php',
    'go': 'file-go',
    'rs': 'file-rust',
    'rb': 'file-ruby',
    'swift': 'file-swift',
    'kt': 'file-kotlin',
    
    // Web文件
    'html': 'file-html',
    'htm': 'file-html',
    'css': 'file-css',
    'scss': 'file-scss',
    'less': 'file-less',
    'sass': 'file-sass',
    
    // 数据文件
    'json': 'file-json',
    'xml': 'file-xml',
    'yml': 'file-yaml',
    'yaml': 'file-yaml',
    'sql': 'file-sql',
    'db': 'file-database',
    
    // 文档文件
    'md': 'file-markdown',
    'txt': 'file-text',
    'doc': 'file-word',
    'docx': 'file-word',
    'pdf': 'file-pdf',
    'xls': 'file-excel',
    'xlsx': 'file-excel',
    'ppt': 'file-powerpoint',
    'pptx': 'file-powerpoint',
    
    // 图片文件
    'jpg': 'file-image',
    'jpeg': 'file-image',
    'png': 'file-image',
    'gif': 'file-image',
    'svg': 'file-svg',
    'webp': 'file-image',
    'ico': 'file-image',
    'bmp': 'file-image',
    
    // 视频文件
    'mp4': 'file-video',
    'avi': 'file-video',
    'mov': 'file-video',
    'wmv': 'file-video',
    'flv': 'file-video',
    'webm': 'file-video',
    
    // 音频文件
    'mp3': 'file-audio',
    'wav': 'file-audio',
    'flac': 'file-audio',
    'aac': 'file-audio',
    'ogg': 'file-audio',
    
    // 压缩文件
    'zip': 'file-archive',
    'rar': 'file-archive',
    '7z': 'file-archive',
    'tar': 'file-archive',
    'gz': 'file-archive',
    
    // 配置文件
    'env': 'file-env',
    'config': 'file-config',
    'conf': 'file-config',
    'ini': 'file-config',
    'cfg': 'file-config',
    'properties': 'file-config',
    
    // Shell脚本
    'sh': 'file-shell',
    'bash': 'file-shell',
    'zsh': 'file-shell',
    'fish': 'file-shell',
    'bat': 'file-shell',
    'cmd': 'file-shell',
    'ps1': 'file-shell',
    
    // 特殊文件
    'dockerfile': 'file-docker',
    'gitignore': 'file-git',
    'gitattributes': 'file-git',
    'license': 'file-license',
    'readme': 'file-readme'
  };
  
  // 检查特殊文件名（不依赖扩展名）
  const lowerName = filename.toLowerCase();
  if (lowerName === 'dockerfile') return 'file-docker';
  if (lowerName === '.gitignore' || lowerName === '.gitattributes') return 'file-git';
  if (lowerName.includes('license')) return 'file-license';
  if (lowerName.includes('readme')) return 'file-readme';
  if (lowerName.includes('package.json')) return 'file-npm';
  if (lowerName.includes('tsconfig')) return 'file-ts';
  if (lowerName.includes('webpack')) return 'file-webpack';
  if (lowerName.includes('vite')) return 'file-vite';
  
  return typeMap[ext || ''] || 'file-default';
};

interface NodeProps {
  node: FileTreeNode;
  level: number;
}

defineProps<NodeProps>();
defineEmits<{
  select: [node: FileTreeNode];
  toggle: [node: FileTreeNode];
  contextmenu: [event: MouseEvent, node: FileTreeNode];
}>();
</script>

<template>
  <div class="tree-node" :style="{ paddingLeft: level * 16 + 'px' }">
    <div 
      class="node-content"
      :class="{ 
        'is-directory': node.type === 'directory',
        'is-expanded': node.isExpanded,
        [getFileTypeClass(node.name)]: node.type === 'file'
      }"
      @click="$emit('select', node)"
      @contextmenu="$emit('contextmenu', $event, node)"
    >
      <div class="node-icon">
        <component :is="getFileIcon(node)" />
      </div>
      <div class="node-name">{{ node.name }}</div>
    </div>
    
    <!-- 子节点 -->
    <div v-if="node.type === 'directory' && node.isExpanded && node.children" class="children">
      <FileTreeNode 
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :level="level + 1"
        @select="(selectedNode: FileTreeNode) => $emit('select', selectedNode)"
        @toggle="(toggledNode: FileTreeNode) => $emit('toggle', toggledNode)"
        @contextmenu="(event: MouseEvent, contextNode: FileTreeNode) => $emit('contextmenu', event, contextNode)"
      />
    </div>
  </div>
</template>

<style scoped lang="less">
.tree-node {
  margin: 0;
  padding: 0;
  
  .node-content {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 4px;
    cursor: pointer;
    user-select: none;
    height: 22px;
    line-height: 22px;
    transition: background-color 0.2s ease;
    
    &:hover {
      background: #2a2d2e;
    }
    
    &.is-directory {
      font-weight: 500;
    }
    
    .node-icon {
      display: flex;
      align-items: center;
      width: 16px;
      height: 16px;
      transition: color 0.2s ease;
      
      :deep(.anticon) {
        font-size: 14px;
      }
    }
    
    .node-name {
      flex: 1;
      font-size: 13px;
      line-height: 22px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    // 文件类型样式
    // JavaScript/TypeScript
    &.file-js .node-icon {
      color: #f7df1e;
    }
    
    &.file-ts .node-icon {
      color: #3178c6;
    }
    
    // 框架文件
    &.file-vue .node-icon {
      color: #4fc08d;
    }
    
    &.file-react .node-icon {
      color: #61dafb;
    }
    
    &.file-angular .node-icon {
      color: #dd0031;
    }
    
    // 编程语言
    &.file-python .node-icon {
      color: #3776ab;
    }
    
    &.file-java .node-icon {
      color: #ed8b00;
    }
    
    &.file-cpp .node-icon {
      color: #00599c;
    }
    
    &.file-c .node-icon {
      color: #a8b9cc;
    }
    
    &.file-php .node-icon {
      color: #777bb4;
    }
    
    &.file-go .node-icon {
      color: #00add8;
    }
    
    &.file-rust .node-icon {
      color: #ce422b;
    }
    
    &.file-ruby .node-icon {
      color: #cc342d;
    }
    
    &.file-swift .node-icon {
      color: #fa7343;
    }
    
    &.file-kotlin .node-icon {
      color: #7f52ff;
    }
    
    // Web文件
    &.file-html .node-icon {
      color: #e34f26;
    }
    
    &.file-css .node-icon {
      color: #1572b6;
    }
    
    &.file-scss .node-icon {
      color: #cf649a;
    }
    
    &.file-less .node-icon {
      color: #1d365d;
    }
    
    &.file-sass .node-icon {
      color: #cf649a;
    }
    
    // 数据文件
    &.file-json .node-icon {
      color: #ffd700;
    }
    
    &.file-xml .node-icon {
      color: #ff6600;
    }
    
    &.file-yaml .node-icon {
      color: #cb171e;
    }
    
    &.file-sql .node-icon {
      color: #336791;
    }
    
    &.file-database .node-icon {
      color: #336791;
    }
    
    // 文档文件
    &.file-markdown .node-icon {
      color: #083fa1;
    }
    
    &.file-text .node-icon {
      color: #858585;
    }
    
    &.file-word .node-icon {
      color: #2b579a;
    }
    
    &.file-pdf .node-icon {
      color: #ff0000;
    }
    
    &.file-excel .node-icon {
      color: #217346;
    }
    
    &.file-powerpoint .node-icon {
      color: #d24726;
    }
    
    // 媒体文件
    &.file-image .node-icon {
      color: #ff6b6b;
    }
    
    &.file-svg .node-icon {
      color: #ffb347;
    }
    
    &.file-video .node-icon {
      color: #9b59b6;
    }
    
    &.file-audio .node-icon {
      color: #e74c3c;
    }
    
    // 压缩文件
    &.file-archive .node-icon {
      color: #f39c12;
    }
    
    // 配置文件
    &.file-env .node-icon {
      color: #ecd53f;
    }
    
    &.file-config .node-icon {
      color: #95a5a6;
    }
    
    // Shell脚本
    &.file-shell .node-icon {
      color: #89e051;
    }
    
    // 特殊文件
    &.file-docker .node-icon {
      color: #2496ed;
    }
    
    &.file-git .node-icon {
      color: #f05032;
    }
    
    &.file-license .node-icon {
      color: #f1c40f;
    }
    
    &.file-readme .node-icon {
      color: #3498db;
    }
    
    &.file-npm .node-icon {
      color: #cb3837;
    }
    
    &.file-webpack .node-icon {
      color: #8dd6f9;
    }
    
    &.file-vite .node-icon {
      color: #646cff;
    }
    
    // 默认文件
    &.file-default .node-icon {
      color: #cccccc;
    }
  }
  
  .children {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
}
</style>