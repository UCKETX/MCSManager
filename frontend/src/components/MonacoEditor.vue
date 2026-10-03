<script setup lang="ts">
import type { WorkspaceDocument } from "@/hooks/useFileWorkspace";
import { t } from "@/lang/i18n";
import { editorLanguage, monaco } from "@/tools/monaco";
import { getRandomId } from "@/tools/randId";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  documents: WorkspaceDocument[];
  activePath: string;
  dark: boolean;
}>();
const emit = defineEmits<{
  change: [path: string, text: string];
  cursor: [line: number, column: number, language: string, eol: string];
  save: [];
}>();
const container = ref<HTMLElement>();
const id = getRandomId();
const models = new Map<
  string,
  {
    model: monaco.editor.ITextModel;
    listener: monaco.IDisposable;
    viewState: monaco.editor.ICodeEditorViewState | null;
  }
>();
let editor: monaco.editor.IStandaloneCodeEditor | undefined;
let displayedPath = "";
let syncing = false;

const updateCursor = () => {
  const position = editor?.getPosition();
  const model = editor?.getModel();
  if (position && model)
    emit(
      "cursor",
      position.lineNumber,
      position.column,
      model.getLanguageId(),
      model.getEOL() === "\r\n" ? "CRLF" : "LF"
    );
};

const synchronize = () => {
  if (!editor) return;
  for (const [path, state] of models) {
    if (!props.documents.some((document) => document.path === path)) {
      if (editor.getModel() === state.model) editor.setModel(null);
      state.listener.dispose();
      state.model.dispose();
      models.delete(path);
    }
  }
  const document = props.documents.find((document) => document.path === props.activePath);
  if (!document) {
    editor.setModel(null);
    displayedPath = "";
    return;
  }
  if (displayedPath !== document.path) {
    const previous = models.get(displayedPath);
    if (previous) previous.viewState = editor.saveViewState();
  }
  let state = models.get(document.path);
  if (!state) {
    const model = monaco.editor.createModel(
      document.text,
      editorLanguage(document.name),
      monaco.Uri.parse(
        `mcsm://workspace/${id}/${document.path.split(/[\\/]/).map(encodeURIComponent).join("/")}`
      )
    );
    const path = document.path;
    state = {
      model,
      viewState: null,
      listener: model.onDidChangeContent(() => {
        if (!syncing) emit("change", path, model.getValue(undefined, true));
        updateCursor();
      })
    };
    models.set(path, state);
  }
  if (state.model.getValue(undefined, true) !== document.text) {
    syncing = true;
    state.model.setValue(document.text);
    syncing = false;
  }
  if (editor.getModel() !== state.model) {
    editor.setModel(state.model);
    if (state.viewState) editor.restoreViewState(state.viewState);
    editor.focus();
  }
  displayedPath = document.path;
  updateCursor();
};

onMounted(() => {
  if (!container.value) return;
  editor = monaco.editor.create(container.value, {
    model: null,
    theme: props.dark ? "vs-dark" : "vs",
    automaticLayout: true,
    fontSize: 14,
    fontFamily: "Menlo, Monaco, Consolas, monospace",
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    padding: { top: 16, bottom: 16 },
    renderWhitespace: "selection",
    wordWrap: "off",
    ariaLabel: t("TXT_CODE_WORKSPACE_TITLE")
  });
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => emit("save"));
  editor.onDidChangeCursorPosition(updateCursor);
  synchronize();
});
watch(() => [props.activePath, props.documents.map((d) => [d.path, d.text])], synchronize);
watch(
  () => props.dark,
  (dark) => monaco.editor.setTheme(dark ? "vs-dark" : "vs")
);
onBeforeUnmount(() => {
  editor?.dispose();
  for (const state of models.values()) {
    state.listener.dispose();
    state.model.dispose();
  }
  models.clear();
});
</script>

<template><div ref="container" class="monaco-container" /></template>

<style scoped>
.monaco-container {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
