<script setup lang="ts">
import { editorLanguage, monaco } from "@/tools/monaco";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  original: string;
  modified: string;
  filename: string;
  dark: boolean;
}>();
const container = ref<HTMLElement>();
let editor: monaco.editor.IStandaloneDiffEditor | undefined;
let originalModel: monaco.editor.ITextModel | undefined;
let modifiedModel: monaco.editor.ITextModel | undefined;
onMounted(() => {
  if (!container.value) return;
  const language = editorLanguage(props.filename);
  originalModel = monaco.editor.createModel(props.original, language);
  modifiedModel = monaco.editor.createModel(props.modified, language);
  editor = monaco.editor.createDiffEditor(container.value, {
    theme: props.dark ? "vs-dark" : "vs",
    automaticLayout: true,
    readOnly: true,
    originalEditable: false,
    renderSideBySide: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false
  });
  editor.setModel({ original: originalModel, modified: modifiedModel });
});
watch(
  () => props.original,
  (text) => originalModel?.setValue(text)
);
watch(
  () => props.modified,
  (text) => modifiedModel?.setValue(text)
);
watch(
  () => props.dark,
  (dark) => monaco.editor.setTheme(dark ? "vs-dark" : "vs")
);
onBeforeUnmount(() => {
  editor?.dispose();
  originalModel?.dispose();
  modifiedModel?.dispose();
});
</script>

<template><div ref="container" style="height: 50vh; min-height: 250px" /></template>
