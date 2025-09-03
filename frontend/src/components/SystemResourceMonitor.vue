<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { LaptopOutlined, DatabaseOutlined, GlobalOutlined } from "@ant-design/icons-vue";

interface ResourceData {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    upload: number;
    download: number;
    status: 'connected' | 'disconnected';
  };
}

const resourceData = ref<ResourceData>({
  cpu: {
    usage: 0,
    cores: 8
  },
  memory: {
    used: 0,
    total: 16,
    percentage: 0
  },
  network: {
    upload: 0,
    download: 0,
    status: 'connected'
  }
});

let updateInterval: NodeJS.Timeout | null = null;

// 模拟数据更新
const updateResourceData = () => {
  resourceData.value = {
    cpu: {
      usage: Math.floor(Math.random() * 10 + 1), // 1-10%
      cores: 8
    },
    memory: {
      used: parseFloat((Math.random() * 2 + 0.4).toFixed(2)), // 0.4-2.4 GB
      total: 16.77,
      percentage: Math.floor(Math.random() * 20 + 10) // 10-30%
    },
    network: {
      upload: Math.random() * 1000 + 500, // 500-1500 B/s
      download: Math.random() * 5000 + 2000, // 2-7 kB/s
      status: 'connected'
    }
  };
};

// 格式化网络速度
const formatNetworkSpeed = (speed: number): string => {
  if (speed < 1024) {
    return `${speed.toFixed(2)} B/s`;
  } else if (speed < 1024 * 1024) {
    return `${(speed / 1024).toFixed(2)} kB/s`;
  } else {
    return `${(speed / (1024 * 1024)).toFixed(2)} MB/s`;
  }
};

// 格式化内存大小
const formatMemory = (sizeInGB: number): string => {
  if (sizeInGB < 1) {
    return `${(sizeInGB * 1024).toFixed(2)} MB`;
  } else {
    return `${sizeInGB.toFixed(2)} GB`;
  }
};

// 获取CPU使用率颜色
const getCpuColor = (usage: number): string => {
  if (usage < 30) return '#52c41a';
  if (usage < 70) return '#faad14';
  return '#ff4d4f';
};

// 获取内存使用率颜色
const getMemoryColor = (percentage: number): string => {
  if (percentage < 50) return '#52c41a';
  if (percentage < 80) return '#faad14';
  return '#ff4d4f';
};

onMounted(() => {
  // 初始化数据
  updateResourceData();
  
  // 每2秒更新一次数据
  updateInterval = setInterval(updateResourceData, 2000);
});

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
</script>

<template>
  <div class="resource-monitor-bar">
    <div class="resource-item">
      <LaptopOutlined class="resource-icon" />
      <span class="resource-text">CPU 负载 {{ resourceData.cpu.usage }}%</span>
    </div>
    
    <div class="resource-separator"></div>
    
    <div class="resource-item">
      <DatabaseOutlined class="resource-icon" />
      <span class="resource-text">内存 {{ formatMemory(resourceData.memory.used) }} / {{ formatMemory(resourceData.memory.total) }}</span>
    </div>
    
    <div class="resource-separator"></div>
    
    <div class="resource-item">
      <GlobalOutlined class="resource-icon" />
      <span class="resource-text">网络 ↓{{ formatNetworkSpeed(resourceData.network.download) }} · ↑{{ formatNetworkSpeed(resourceData.network.upload) }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.resource-monitor-bar {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  border-radius: 6px;
  padding: 8px 16px;
  margin-bottom: 8px;
  backdrop-filter: blur(10px);
  font-size: 13px;
  color: #fff;
  
  .resource-item {
    display: flex;
    align-items: center;
    gap: 6px;
    
    .resource-icon {
      font-size: 14px;
      color: #1890ff;
    }
    
    .resource-text {
      color: #fff;
      font-weight: 400;
      white-space: nowrap;
    }
  }
  
  .resource-separator {
    width: 1px;
    height: 16px;
    background: #444;
    margin: 0 16px;
  }
  
  &:hover {
    background: rgba(0, 0, 0, 0.9);
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    
    .resource-separator {
      display: none;
    }
  }
}
</style>