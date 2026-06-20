<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useCanBusStore } from './store/canbus';
import { useTemplatesStore } from './store/templates';
import FrameTable from './components/FrameTable.vue';
import SignalChart from './components/SignalChart.vue';
import DiagnosticTemplatePanel from './components/DiagnosticTemplatePanel.vue';
import AlarmPanel from './components/AlarmPanel.vue';
import type { DiagnosticTemplate } from './types';

const store = useCanBusStore();
const templatesStore = useTemplatesStore();

const showTemplatePanel = ref(false);

const currentTemplateName = computed(() => {
  if (!store.activeTemplateId) return '';
  const tpl = templatesStore.getTemplate(store.activeTemplateId);
  return tpl?.name || '';
});

const sortedTemplates = computed(() =>
  [...templatesStore.templates].sort((a, b) => b.updatedAt - a.updatedAt)
);

function applyVehicleTemplate() {
  const vehicle = templatesStore.currentVehicle;
  if (!vehicle) return;
  if (vehicle.activeTemplateId) {
    const tpl = templatesStore.getTemplate(vehicle.activeTemplateId);
    if (tpl) {
      store.applyTemplate(tpl);
    }
  } else {
    store.clearTemplateState();
  }
}

function handleQuickTemplateChange(templateId: string) {
  if (!templateId) {
    store.clearTemplateState();
    if (templatesStore.currentVehicle) {
      templatesStore.setVehicleTemplate(templatesStore.currentVehicle.id, null);
    }
    return;
  }
  const tpl = templatesStore.getTemplate(templateId);
  if (tpl) {
    store.applyTemplate(tpl);
    if (templatesStore.currentVehicle) {
      templatesStore.setVehicleTemplate(templatesStore.currentVehicle.id, tpl.id);
    }
  }
}

watch(() => templatesStore.currentVehicleId, () => {
  applyVehicleTemplate();
});

onMounted(() => {
  if (templatesStore.currentVehicle) {
    applyVehicleTemplate();
  }
});

function handleLoadDbc() {
  store.loadMockDbc();
  alert(`已加载 DBC 定义: ${store.dbcMessages.size} 条消息`);
}

function handleExport() {
  const csv = store.exportFrames();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `can_frames_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>
        <h1 class="text-lg font-bold text-gray-100">CAN 总线数据帧解析与诊断仪</h1>
      </div>

      <div class="flex items-center gap-2">
        <!-- Vehicle selector -->
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm">
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l1.5-3h6L13 8M3 8v10a1 1 0 001 1h16a1 1 0 001-1V8M3 8h18M8 12h.01M12 12h.01M16 12h.01" />
          </svg>
          <select
            v-if="templatesStore.vehicles.length > 0"
            :value="templatesStore.currentVehicleId || ''"
            @change="templatesStore.switchVehicle(($event.target as HTMLSelectElement).value)"
            class="bg-transparent text-gray-200 text-sm focus:outline-none cursor-pointer max-w-[120px]"
          >
            <option v-for="v in templatesStore.vehicles" :key="v.id" :value="v.id" class="bg-gray-800">
              {{ v.name }}
            </option>
          </select>
          <span v-else class="text-gray-500 text-sm">无车辆</span>
        </div>

        <!-- Quick template selector -->
        <div
          v-if="templatesStore.vehicles.length > 0"
          class="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm"
        >
          <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <select
            :value="store.activeTemplateId || ''"
            @change="handleQuickTemplateChange(($event.target as HTMLSelectElement).value)"
            class="bg-transparent text-gray-200 text-sm focus:outline-none cursor-pointer max-w-[140px]"
          >
            <option value="" class="bg-gray-800">— 无模板 —</option>
            <option v-for="tpl in sortedTemplates" :key="tpl.id" :value="tpl.id" class="bg-gray-800">
              {{ tpl.name }}
            </option>
          </select>
        </div>

        <button
          @click="showTemplatePanel = true"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-sm rounded transition-colors border border-cyan-500 font-medium"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          诊断模板
          <span
            v-if="store.unacknowledgedAlarmCount > 0"
            class="ml-0.5 text-xs px-1.5 py-0.5 bg-red-600 text-white rounded-full font-bold"
          >
            {{ store.unacknowledgedAlarmCount }}
          </span>
        </button>

        <button
          @click="handleLoadDbc"
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors border border-gray-600"
        >
          加载DBC
        </button>
        <button
          @click="store.isCapturing ? store.stopCapture() : store.startCapture()"
          class="px-3 py-1.5 text-sm rounded transition-colors font-medium"
          :class="store.isCapturing
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-green-600 hover:bg-green-700 text-white'"
        >
          {{ store.isCapturing ? '停止捕获' : '开始捕获' }}
        </button>
        <button
          @click="store.clearFrames()"
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors border border-gray-600"
        >
          清除
        </button>
        <button
          @click="handleExport"
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors border border-gray-600"
        >
          导出CSV
        </button>
      </div>
    </header>

    <!-- Main Area -->
    <main class="flex-1 flex overflow-hidden">
      <!-- Left Panel: Frame Table (60%) -->
      <div class="w-3/5 border-r border-gray-700 flex flex-col overflow-hidden">
        <FrameTable />
      </div>

      <!-- Right Panel: Signal Chart (40%) -->
      <div class="w-2/5 flex flex-col overflow-hidden">
        <SignalChart />
      </div>
    </main>

    <!-- Status Bar -->
    <footer class="flex items-center justify-between px-6 py-1.5 bg-gray-800 border-t border-gray-700 text-xs shrink-0">
      <div class="flex items-center gap-4 text-gray-500">
        <span>
          <span :class="store.isCapturing ? 'text-green-400' : 'text-gray-500'">
            ● {{ store.isCapturing ? '捕获中' : '已停止' }}
          </span>
        </span>
        <span>DBC消息: {{ store.dbcMessages.size }}</span>
        <span v-if="store.activeTemplateId" class="text-cyan-400">
          模板: {{ currentTemplateName }}
        </span>
        <span v-if="store.focusSignals.length > 0" class="text-cyan-400">
          关注信号: {{ store.focusSignals.length }}
        </span>
        <span v-if="store.alarmRules.length > 0" class="text-yellow-500">
          告警规则: {{ store.alarmRules.length }}
        </span>
      </div>
      <div class="flex items-center gap-4 text-gray-500">
        <span>帧数: {{ store.busStats.totalFrames }}</span>
        <span>RX: {{ store.busStats.rxCount }}</span>
        <span>TX: {{ store.busStats.txCount }}</span>
        <span>负载: {{ store.busLoadPercent }}%</span>
      </div>
    </footer>

    <!-- Diagnostic Template Panel -->
    <DiagnosticTemplatePanel
      :visible="showTemplatePanel"
      @close="showTemplatePanel = false"
    />

    <!-- Alarm Panel -->
    <AlarmPanel />
  </div>
</template>
