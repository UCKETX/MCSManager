<script setup lang="ts">
import { getFileExtName, getFileIcon } from "@/tools/fileManager";
import {
  BranchesOutlined,
  CoffeeOutlined,
  CodeOutlined,
  CodeSandboxOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  FileZipOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  MoreOutlined,
  SettingOutlined
} from "@ant-design/icons-vue";
import { computed, type Component } from "vue";

const props = defineProps<{
  filename: string;
  directory?: boolean;
  expanded?: boolean;
  more?: boolean;
}>();

interface FileIcon {
  icon?: Component;
  badge?: string;
  color?: string;
  foreground?: string;
}

const badges: Record<string, FileIcon> = {
  js: { badge: "JS", color: "#f0db4f", foreground: "#292929" },
  ts: { badge: "TS", color: "#3178c6" },
  jsx: { badge: "JSX", color: "#197c98" },
  tsx: { badge: "TSX", color: "#3178c6" },
  py: { badge: "PY", color: "#3776ab" },
  json: { badge: "{}", color: "#a66b17" },
  yaml: { badge: "YML", color: "#9854b8" },
  toml: { badge: "T", color: "#a65343" },
  vue: { badge: "V", color: "#23845d" },
  css: { badge: "CSS", color: "#6c55b6" },
  scss: { badge: "S", color: "#b54f86" },
  html: { badge: "<>", color: "#cf5328" },
  xml: { badge: "</>", color: "#cf5328" },
  go: { badge: "GO", color: "#087f9c" },
  rs: { badge: "RS", color: "#9e5944" },
  c: { badge: "C", color: "#5674a1" },
  cpp: { badge: "C++", color: "#3178c6" },
  cs: { badge: "C#", color: "#7752a8" },
  php: { badge: "PHP", color: "#626b9a" },
  mcfunction: { badge: ">_", color: "#458844" }
};
const aliases: Record<string, string> = {
  mjs: "js",
  cjs: "js",
  mts: "ts",
  cts: "ts",
  pyw: "py",
  json5: "json",
  jsonc: "json",
  yml: "yaml",
  htm: "html",
  less: "css",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  h: "c"
};

const fileIcon = computed<FileIcon>(() => {
  if (props.more) return { icon: MoreOutlined };
  if (props.directory)
    return { icon: props.expanded ? FolderOpenOutlined : FolderOutlined, color: "#b88a36" };
  const name = props.filename.split(/[\\/]/).pop()?.toLowerCase() || "";
  const extension = getFileExtName(name);
  if (/^dockerfile(?:\.|$)/.test(name) || name === ".dockerignore")
    return { icon: CodeSandboxOutlined, color: "#2496c8" };
  if ([".gitignore", ".gitattributes", ".gitmodules"].includes(name))
    return { icon: BranchesOutlined, color: "#d76545" };
  if (
    /^\.env(?:\.|$)/.test(name) ||
    ["properties", "ini", "conf", "cfg", "env"].includes(extension)
  )
    return { icon: SettingOutlined, color: "#b47b24" };
  if (badges[aliases[extension] || extension]) return badges[aliases[extension] || extension];
  if (["java", "class"].includes(extension)) return { icon: CoffeeOutlined, color: "#cf643f" };
  if (["jar", "war"].includes(extension)) return { icon: FileZipOutlined, color: "#cf643f" };
  if (["sh", "bash", "zsh", "fish", "bat", "cmd", "ps1"].includes(extension))
    return { icon: CodeOutlined, color: "#458844" };
  if (["sql", "db", "sqlite", "sqlite3"].includes(extension))
    return { icon: DatabaseOutlined, color: "#b47b24" };
  if (["txt", "log"].includes(extension)) return { icon: FileTextOutlined };
  return { icon: getFileIcon(name, 1) };
});
</script>

<template>
  <span class="workspace-file-icon" aria-hidden="true" :style="{ color: fileIcon.color }">
    <svg v-if="fileIcon.badge" viewBox="0 0 20 20" focusable="false">
      <rect x="1" y="1" width="18" height="18" rx="2" fill="currentColor" />
      <text
        x="10"
        y="13.6"
        text-anchor="middle"
        :fill="fileIcon.foreground || '#fff'"
        :font-size="fileIcon.badge.length > 2 ? 8 : 10"
        font-family="Arial, sans-serif"
        font-weight="700"
      >
        {{ fileIcon.badge }}
      </text>
    </svg>
    <component :is="fileIcon.icon" v-else />
  </span>
</template>

<style scoped>
.workspace-file-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  font-size: 16px;
  line-height: 1;
}
.workspace-file-icon svg {
  width: 100%;
  height: 100%;
}
</style>
