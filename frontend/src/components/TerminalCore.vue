<script setup lang="ts">
import connectErrorImage from "@/assets/daemon_connection_error.png";
import { useCommandHistoryStore } from "@/stores/useCommandHistoryStore";
import { useXhrPollError } from "@/hooks/useXhrPollError";
import { t } from "@/lang/i18n";
import { getInstanceOutputLog } from "@/services/apis/instance";
import { useLayoutContainerStore } from "@/stores/useLayoutContainerStore";
import { CodeOutlined, DeleteOutlined, LoadingOutlined, HistoryOutlined } from "@ant-design/icons-vue";
import { Terminal } from "@xterm/xterm";
import { message } from "ant-design-vue";
import { onMounted, onUnmounted, ref } from "vue";
import { encodeConsoleColor, type UseTerminalHook } from "../hooks/useTerminal";
import { getRandomId } from "../tools/randId";
import SystemResourceMonitor from "@/components/SystemResourceMonitor.vue";
import CommandHistoryPanel from "@/components/CommandHistoryPanel.vue";

const props = defineProps<{
  instanceId: string;
  daemonId: string;
  height: string;
  useTerminalHook: UseTerminalHook;
}>();

const { containerState } = useLayoutContainerStore();

// 使用新的历史命令存储
const historyStore = useCommandHistoryStore();

const {
  state,
  events,
  isConnect,
  socketAddress,
  execute: setUpTerminal,
  initTerminalWindow,
  sendCommand,
  clearTerminal
} = props.useTerminalHook;

const instanceId = props.instanceId;
const daemonId = props.daemonId;

const terminalDomId = `terminal-window-${getRandomId()}`;

const socketError = ref<Error>();
const { isXhrPollError, xhrPollErrorReason } = useXhrPollError(socketError);

let term: Terminal | undefined;

let inputRef = ref<HTMLElement | null>(null);

const handleSendCommand = () => {
  if (historyStore.isPanelVisible) return;
  const command = historyStore.commandInputValue;
  if (command.trim()) {
    // 添加到历史记录
    historyStore.addCommand(command);
    // 发送命令
    sendCommand(command);
    // 清空输入
    historyStore.commandInputValue = "";
  }
};

// 处理历史命令选择
const handleCommandSelect = (command: string) => {
  historyStore.commandInputValue = command;
  inputRef.value?.focus();
};

// 切换历史面板显示
const toggleHistoryPanel = () => {
  historyStore.togglePanel();
};

// 处理键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
  // Ctrl+H 或 Cmd+H 切换历史面板
  if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
    event.preventDefault();
    toggleHistoryPanel();
    return;
  }
  
  // 如果面板打开，让面板处理键盘事件
  if (historyStore.isPanelVisible) {
    return;
  }
};

const initTerminal = async () => {
  if (containerState.isDesignMode) return;
  const dom = document.getElementById(terminalDomId);
  if (dom) {
    const term = initTerminalWindow(dom);
    return term;
  }
  throw new Error(t("TXT_CODE_42bcfe0c"));
};

events.on("opened", () => {
  message.success(t("TXT_CODE_e13abbb1"));
});

events.on("stopped", () => {
  message.success(t("TXT_CODE_efb6d377"));
});

events.on("error", (error: Error) => {
  socketError.value = error;
});

events.once("detail", async () => {
  try {
    const { value } = await getInstanceOutputLog().execute({
      params: { uuid: instanceId || "", daemonId: daemonId || "" }
    });

    if (value) {
      if (state.value?.config?.terminalOption?.haveColor) {
        term?.write(encodeConsoleColor(value));
      } else {
        term?.write(value);
      }
    }
  } catch (error: any) {}
});

const refreshPage = () => {
  window.location.reload();
};

// Initialize the terminal when the component is mounted.
// Do not reinitialize it in the parent component.
onMounted(async () => {
  try {
    if (instanceId && daemonId) {
      await setUpTerminal({
        instanceId,
        daemonId
      });
    }
    term = await initTerminal();
    
    // 添加全局键盘事件监听
    document.addEventListener('keydown', handleKeyDown);
  } catch (error: any) {
    console.error(error);
    throw error;
  }
});

// 清理事件监听
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <!-- Terminal Page View -->
  <div class="console-wrapper">
    <div v-if="!isConnect" class="terminal-loading">
      <LoadingOutlined style="font-size: 72px; color: white" />
    </div>
    <div class="terminal-button-group position-absolute-right position-absolute-top">
      <ul>
        <li @click="clearTerminal()">
          <a-tooltip placement="top">
            <template #title>
              <span>{{ t("TXT_CODE_b1e2e1b4") }}</span>
            </template>
            <delete-outlined />
          </a-tooltip>
        </li>
      </ul>
    </div>
    <!-- 系统资源监控面板 -->
    <SystemResourceMonitor />
    
    <div class="terminal-wrapper global-card-container-shadow position-relative">
      <div class="terminal-container">
        <div
          v-if="!containerState.isDesignMode"
          :id="terminalDomId"
          :style="{ height: props.height }"
        >
        </div>
        <div v-else :style="{ height: props.height }">
          <p class="terminal-design-tip">{{ $t("TXT_CODE_7ac6f85c") }}</p>
        </div>
      </div>
    </div>
    <div class="command-input">
      <!-- 命令输入框 -->
      <div class="input-wrapper">
        <a-input
          ref="inputRef"
          v-model:value="historyStore.commandInputValue"
          :placeholder="t('TXT_CODE_555e2c1b')"
          autofocus
          :disabled="containerState.isDesignMode || !isConnect"
          @press-enter="handleSendCommand"
          @keydown="handleKeyDown"
        >
          <template #prefix>
            <CodeOutlined style="font-size: 18px" />
          </template>
          <template #suffix>
            <a-tooltip title="历史命令 (Ctrl+H)">
              <a-button 
                type="text" 
                size="small"
                @click="toggleHistoryPanel"
                :class="{ 'active': historyStore.isPanelVisible }"
              >
                <HistoryOutlined />
              </a-button>
            </a-tooltip>
          </template>
        </a-input>
      </div>
    </div>
    
    <!-- 历史命令面板 - 独立卡片 -->
    <CommandHistoryPanel :on-command-select="handleCommandSelect" />

    <!-- Error Dialog -->
    <div v-if="socketError" class="error-card">
      <div class="error-card-container">
        <a-typography-title :level="5">{{ $t("TXT_CODE_6929b0b2") }}</a-typography-title>
        <a-typography-paragraph>
          {{ $t("TXT_CODE_812a629e") + socketAddress }}
        </a-typography-paragraph>
        <div>
          <img :src="connectErrorImage" style="width: 100%; height: 110px" />
        </div>
        <a-typography-title :level="5">{{ $t("TXT_CODE_9c95b60f") }}</a-typography-title>
        <a-typography-paragraph>
          <pre style="font-size: 12px"><code>{{ socketError?.message||"" }}</code></pre>

          <div v-if="isXhrPollError" style="font-size: 12px">
            <span> {{ xhrPollErrorReason }}</span>
          </div>
        </a-typography-paragraph>
        <a-typography-paragraph v-if="isXhrPollError">
          <div class="flex" style="gap: 8px; font-size: 12px">
            <span>
              <strong>{{ $t("TXT_CODE_d4c8fb3b") }}</strong>
            </span>
            <a
              href="https://docs.mcsmanager.com/ops/proxy_https.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ $t("TXT_CODE_9b3ce825") }}
            </a>
            <span>|</span>
            <a
              href="https://docs.mcsmanager.com/ops/mcsm_network.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ $t("TXT_CODE_10cc2794") }}
            </a>
          </div>
        </a-typography-paragraph>
        <a-typography-title :level="5">{{ $t("TXT_CODE_f1c96d8a") }}</a-typography-title>
        <a-typography-paragraph>
          <ul>
            <li>
              {{ $t("TXT_CODE_ceba9262") }}
            </li>
            <li>
              {{ $t("TXT_CODE_84099e5") }}
            </li>
            <li>
              {{ $t("TXT_CODE_86ff658a") }}
            </li>
          </ul>
          <div class="flex flex-center">
            <a-typography-link @click="refreshPage">
              {{ $t("TXT_CODE_f8b28901") }}
            </a-typography-link>
          </div>
        </a-typography-paragraph>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.error-card {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  z-index: 10;
  border-radius: 20px;

  display: flex;
  align-items: center;
  justify-content: center;

  .error-card-container {
    overflow: hidden;
    max-width: 440px;
    border: 1px solid var(--color-gray-6) !important;
    background-color: var(--color-gray-1);
    border-radius: 4px;
    padding: 12px;
    box-shadow: 0px 0px 2px var(--color-gray-7);
  }

  @media (max-width: 992px) {
    .error-card-container {
      max-width: 90vw !important;
    }
  }
}
.console-wrapper {
  position: relative;

  .terminal-loading {
    z-index: 12;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .terminal-button-group {
    z-index: 11;
    margin-right: 20px;
    padding-bottom: 50px;
    padding-left: 50px;
    border-radius: 6px;
    color: #fff;

    &:hover {
      ul {
        transition: all 1s;
        opacity: 0.8;
      }
    }

    ul {
      display: flex;
      opacity: 0;

      li {
        cursor: pointer;
        list-style: none;
        padding: 5px;
        margin-left: 5px;
        border-radius: 6px;
        font-size: 20px;

        &:hover {
          background-color: #3e3e3e;
        }
      }
    }
  }

  .terminal-wrapper {
    border: 1px solid var(--card-border-color);
    position: relative;
    overflow: hidden;
    height: 100%;
    background-color: #1e1e1e;
    padding: 8px;
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    width: 100%;
    color: #fff;
    font-family: "Courier New", Courier, monospace;
    font-size: 14px;
    line-height: 1.2;
    .terminal-container {
      // min-width: 1200px;
      height: 100%;
    }

    margin-bottom: 12px;
  }

  .command-input {
    position: relative;

    .input-wrapper {
      position: relative;
      
      .ant-btn.active {
        color: var(--color-primary);
        background-color: var(--color-primary-bg);
      }
    }
  }

  .terminal-design-tip {
    color: rgba(255, 255, 255, 0.584);
  }
}
</style>
