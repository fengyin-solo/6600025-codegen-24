<script setup lang="ts">
import { ref } from 'vue';
import { useCanBusStore } from '../store/canbus';

const canbus = useCanBusStore();
const expanded = ref(false);

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + d.getMilliseconds().toString().padStart(3, '0');
}

const operatorLabel: Record<string, string> = {
  '>': '>',
  '<': '<',
  '>=': '≥',
  '<=': '≤',
  '==': '=',
  '!=': '≠'
};
</script>

<template>
  <div
    v-if="canbus.activeAlarms.length > 0"
    class="fixed bottom-4 right-4 z-40 w-96 max-w-[90vw] bg-gray-900 rounded-xl border shadow-2xl overflow-hidden"
    :class="canbus.unacknowledgedAlarmCount > 0 ? 'border-red-500' : 'border-gray-700'"
  >
    <!-- Header -->
    <button
      @click="expanded = !expanded"
      class="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
      :class="canbus.unacknowledgedAlarmCount > 0 ? 'bg-red-900/40 hover:bg-red-900/60' : 'bg-gray-800 hover:bg-gray-750'"
    >
      <div class="flex items-center gap-2">
        <span class="relative flex h-2.5 w-2.5">
          <span
            v-if="canbus.unacknowledgedAlarmCount > 0"
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
          ></span>
          <span
            class="relative inline-flex rounded-full h-2.5 w-2.5"
            :class="canbus.unacknowledgedAlarmCount > 0 ? 'bg-red-500' : 'bg-gray-500'"
          ></span>
        </span>
        <span class="text-sm font-semibold" :class="canbus.unacknowledgedAlarmCount > 0 ? 'text-red-300' : 'text-gray-300'">
          告警通知
        </span>
        <span
          v-if="canbus.unacknowledgedAlarmCount > 0"
          class="text-xs px-1.5 py-0.5 bg-red-600 text-white rounded-full font-bold"
        >
          {{ canbus.unacknowledgedAlarmCount }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="canbus.unacknowledgedAlarmCount > 0"
          @click.stop="canbus.acknowledgeAllAlarms()"
          class="text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
        >
          全部确认
        </button>
        <svg
          class="w-4 h-4 text-gray-400 transition-transform"
          :class="expanded ? 'rotate-180' : ''"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>

    <!-- Alarm list -->
    <div v-if="expanded" class="max-h-80 overflow-y-auto border-t border-gray-700">
      <div
        v-for="alarm in canbus.activeAlarms"
        :key="alarm.id"
        class="px-4 py-2.5 border-b border-gray-800 flex items-start gap-2 transition-colors"
        :class="alarm.acknowledged ? 'opacity-50' : ''"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span
              class="text-xs px-1.5 py-0.5 rounded font-bold"
              :class="alarm.acknowledged ? 'bg-gray-700 text-gray-400' : 'bg-red-900/60 text-red-300'"
            >
              {{ alarm.acknowledged ? '已确认' : '告警' }}
            </span>
            <span class="text-sm text-gray-100 font-medium truncate">{{ alarm.ruleName }}</span>
          </div>
          <div class="text-xs text-gray-400 font-mono mt-1">
            {{ alarm.signalName }} {{ operatorLabel[alarm.operator] }} {{ alarm.threshold }}
            <span class="text-yellow-300 ml-1">实际: {{ alarm.actualValue.toFixed(1) }}</span>
          </div>
          <div class="text-xs text-gray-500 mt-0.5">{{ formatTime(alarm.timestamp) }}</div>
        </div>
        <button
          v-if="!alarm.acknowledged"
          @click="canbus.acknowledgeAlarm(alarm.id)"
          class="text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors shrink-0"
        >
          确认
        </button>
      </div>
      <div class="px-4 py-2 flex justify-between items-center bg-gray-850" style="background-color:#1a2234;">
        <span class="text-xs text-gray-500">共 {{ canbus.activeAlarms.length }} 条记录</span>
        <button
          @click="canbus.clearAlarms()"
          class="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          清除全部
        </button>
      </div>
    </div>
  </div>
</template>
