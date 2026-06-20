<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useCanBusStore } from '../store/canbus';
import { useTemplatesStore } from '../store/templates';
import type { AlarmOperator, AlarmRule, DiagnosticTemplate, Vehicle } from '../types';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const canbus = useCanBusStore();
const templatesStore = useTemplatesStore();

const activeTab = ref<'templates' | 'signals' | 'rules' | 'vehicles'>('templates');

const newTemplateName = ref('');
const newTemplateDesc = ref('');
const editingTemplateId = ref<string | null>(null);

const newVehicleName = ref('');
const newVehicleVin = ref('');

const newRule = ref({
  signalName: '',
  operator: '>' as AlarmOperator,
  threshold: 0,
  message: '',
  enabled: true
});

const operatorOptions: { value: AlarmOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '≥' },
  { value: '<=', label: '≤' },
  { value: '==', label: '=' },
  { value: '!=', label: '≠' }
];

const sortedTemplates = computed(() =>
  [...templatesStore.templates].sort((a, b) => b.updatedAt - a.updatedAt)
);

const isEditing = computed(() => editingTemplateId.value !== null);

function resetForm() {
  newTemplateName.value = '';
  newTemplateDesc.value = '';
  editingTemplateId.value = null;
}

function startSaveAsNew() {
  newTemplateName.value = '';
  newTemplateDesc.value = '';
  editingTemplateId.value = null;
  activeTab.value = 'templates';
}

function startUpdateExisting(template: DiagnosticTemplate) {
  editingTemplateId.value = template.id;
  newTemplateName.value = template.name;
  newTemplateDesc.value = template.description;
  activeTab.value = 'templates';
}

function handleSaveTemplate() {
  if (!newTemplateName.value.trim()) {
    alert('请输入模板名称');
    return;
  }
  const template = canbus.buildTemplateFromCurrent(newTemplateName.value, newTemplateDesc.value);
  if (editingTemplateId.value) {
    template.id = editingTemplateId.value;
    const existing = templatesStore.getTemplate(editingTemplateId.value);
    if (existing) {
      template.createdAt = existing.createdAt;
    }
  }
  const saved = templatesStore.saveTemplate(template);
  canbus.applyTemplate(saved);
  if (templatesStore.currentVehicle) {
    templatesStore.setVehicleTemplate(templatesStore.currentVehicle.id, saved.id);
  }
  resetForm();
  alert(editingTemplateId.value ? '模板已更新' : '模板已保存');
}

function handleLoadTemplate(template: DiagnosticTemplate) {
  canbus.applyTemplate(template);
  if (templatesStore.currentVehicle) {
    templatesStore.setVehicleTemplate(templatesStore.currentVehicle.id, template.id);
  }
  emit('close');
}

function handleDeleteTemplate(id: string) {
  if (confirm('确认删除此诊断模板？此操作不可撤销。')) {
    templatesStore.deleteTemplate(id);
    if (canbus.activeTemplateId === id) {
      canbus.clearTemplateState();
    }
  }
}

function handleAddAlarmRule() {
  if (!newRule.value.signalName) {
    alert('请选择信号');
    return;
  }
  canbus.addAlarmRule({ ...newRule.value });
  newRule.value = {
    signalName: '',
    operator: '>',
    threshold: 0,
    message: '',
    enabled: true
  };
}

function handleToggleRule(rule: AlarmRule) {
  canbus.updateAlarmRule(rule.id, { enabled: !rule.enabled });
}

function handleRemoveRule(id: string) {
  canbus.removeAlarmRule(id);
}

function handleToggleSignal(name: string) {
  canbus.toggleFocusSignal(name);
}

function handleAddVehicle() {
  if (!newVehicleName.value.trim()) {
    alert('请输入车辆名称');
    return;
  }
  const vehicle = templatesStore.addVehicle(newVehicleName.value, newVehicleVin.value);
  templatesStore.switchVehicle(vehicle.id);
  newVehicleName.value = '';
  newVehicleVin.value = '';
}

function handleSwitchVehicle(id: string) {
  templatesStore.switchVehicle(id);
}

function handleDeleteVehicle(id: string) {
  if (confirm('确认删除此车辆？已保存的模板仍可复用。')) {
    templatesStore.deleteVehicle(id);
  }
}

function handleVehicleTemplateChange(vehicleId: string, templateId: string) {
  const tplId = templateId || null;
  templatesStore.setVehicleTemplate(vehicleId, tplId);
  if (templatesStore.currentVehicleId === vehicleId && tplId) {
    const tpl = templatesStore.getTemplate(tplId);
    if (tpl) {
      canbus.applyTemplate(tpl);
    }
  } else if (templatesStore.currentVehicleId === vehicleId && !tplId) {
    canbus.clearTemplateState();
  }
}

function handleApplyVehicleTemplate(vehicle: Vehicle) {
  if (!vehicle.activeTemplateId) return;
  const tpl = templatesStore.getTemplate(vehicle.activeTemplateId);
  if (tpl) {
    canbus.applyTemplate(tpl);
    alert(`已应用模板: ${tpl.name}`);
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

function getTemplateName(id: string | null): string {
  if (!id) return '无';
  const tpl = templatesStore.getTemplate(id);
  return tpl?.name || '未知模板';
}

watch(() => props.visible, (val) => {
  if (val) {
    activeTab.value = 'templates';
    resetForm();
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div class="w-[760px] max-w-[92vw] max-h-[88vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 bg-gray-800 border-b border-gray-700">
          <h2 class="text-base font-semibold text-gray-100 flex items-center gap-2">
            <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            共享诊断模板
          </h2>
          <button
            @click="emit('close')"
            class="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-gray-700 bg-gray-850" style="background-color:#1a2234;">
          <button
            v-for="tab in [
              { key: 'templates', label: '模板库', count: sortedTemplates.length },
              { key: 'signals', label: '关注信号', count: canbus.focusSignals.length },
              { key: 'rules', label: '告警规则', count: canbus.alarmRules.length },
              { key: 'vehicles', label: '车辆管理', count: templatesStore.vehicles.length }
            ]"
            :key="tab.key"
            @click="activeTab = tab.key as typeof activeTab"
            class="px-4 py-2.5 text-sm font-medium transition-colors border-b-2"
            :class="activeTab === tab.key
              ? 'text-cyan-400 border-cyan-500'
              : 'text-gray-400 border-transparent hover:text-gray-200'"
          >
            {{ tab.label }}
            <span class="ml-1 text-xs px-1.5 py-0.5 rounded-full" :class="activeTab === tab.key ? 'bg-cyan-900/50 text-cyan-300' : 'bg-gray-700 text-gray-400'">
              {{ tab.count }}
            </span>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-5">

          <!-- Templates Tab -->
          <div v-if="activeTab === 'templates'">
            <!-- Save form -->
            <div class="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
              <h3 class="text-sm font-semibold text-gray-200 mb-3">
                {{ isEditing ? '更新当前模板' : '保存当前配置为新模板' }}
              </h3>
              <div class="grid grid-cols-1 gap-3">
                <input
                  v-model="newTemplateName"
                  type="text"
                  placeholder="模板名称（如：发动机异常诊断套件）"
                  class="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <textarea
                  v-model="newTemplateDesc"
                  rows="2"
                  placeholder="模板描述（可选）"
                  class="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>
              <div class="flex items-center justify-between mt-3">
                <p class="text-xs text-gray-500">
                  将保存：筛选条件 · {{ canbus.focusSignals.length }} 个关注信号 · {{ canbus.alarmRules.length }} 条告警规则
                </p>
                <div class="flex gap-2">
                  <button
                    v-if="isEditing"
                    @click="resetForm"
                    class="px-3 py-1.5 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    取消编辑
                  </button>
                  <button
                    @click="handleSaveTemplate"
                    class="px-4 py-1.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded transition-colors"
                  >
                    {{ isEditing ? '更新模板' : '保存模板' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Template list -->
            <div v-if="sortedTemplates.length === 0" class="text-center py-8 text-gray-500 text-sm">
              暂无已保存的模板
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="tpl in sortedTemplates"
                :key="tpl.id"
                class="bg-gray-800 rounded-lg p-3 border transition-colors"
                :class="canbus.activeTemplateId === tpl.id ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-700 hover:border-gray-600'"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-gray-100 truncate">{{ tpl.name }}</span>
                      <span
                        v-if="canbus.activeTemplateId === tpl.id"
                        class="text-xs px-1.5 py-0.5 bg-cyan-900/50 text-cyan-300 rounded"
                      >
                        当前
                      </span>
                    </div>
                    <p v-if="tpl.description" class="text-xs text-gray-400 mt-1 line-clamp-2">{{ tpl.description }}</p>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                      <span>筛选: {{ tpl.filterText || tpl.filterId || '无' }}</span>
                      <span>·</span>
                      <span>信号: {{ tpl.focusSignals.length }}</span>
                      <span>·</span>
                      <span>告警: {{ tpl.alarmRules.length }}</span>
                      <span>·</span>
                      <span>{{ formatDate(tpl.updatedAt) }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      @click="handleLoadTemplate(tpl)"
                      class="px-2.5 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                    >
                      应用
                    </button>
                    <button
                      @click="startUpdateExisting(tpl)"
                      class="px-2.5 py-1 text-xs text-gray-200 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      覆盖更新
                    </button>
                    <button
                      @click="handleDeleteTemplate(tpl.id)"
                      class="px-2.5 py-1 text-xs text-red-300 bg-red-900/30 hover:bg-red-900/50 rounded transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Signals Tab -->
          <div v-if="activeTab === 'signals'">
            <p class="text-xs text-gray-500 mb-3">
              选择关注的信号，将在趋势图中高亮显示。配置可保存到模板，切换车辆后直接复用。
            </p>
            <div v-if="canbus.availableSignals.length === 0" class="text-center py-8 text-gray-500 text-sm">
              暂无可用信号 — 请先加载 DBC 或开始捕获
            </div>
            <div v-else class="grid grid-cols-2 gap-2">
              <label
                v-for="sig in canbus.availableSignals"
                :key="sig"
                class="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded border cursor-pointer transition-colors"
                :class="canbus.focusSignals.includes(sig) ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-700 hover:border-gray-600'"
              >
                <input
                  type="checkbox"
                  :checked="canbus.focusSignals.includes(sig)"
                  @change="handleToggleSignal(sig)"
                  class="w-4 h-4 accent-cyan-500"
                />
                <span class="text-sm text-gray-200 truncate">{{ sig }}</span>
              </label>
            </div>
          </div>

          <!-- Rules Tab -->
          <div v-if="activeTab === 'rules'">
            <p class="text-xs text-gray-500 mb-3">
              设置告警规则，当信号值满足条件时自动触发告警。规则保存在模板中，可跨车辆复用。
            </p>
            <!-- Add rule form -->
            <div class="bg-gray-800 rounded-lg p-3 mb-4 border border-gray-700">
              <div class="flex flex-wrap items-center gap-2">
                <select
                  v-model="newRule.signalName"
                  class="flex-1 min-w-[140px] px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="">选择信号</option>
                  <option v-for="sig in canbus.availableSignals" :key="sig" :value="sig">{{ sig }}</option>
                </select>
                <select
                  v-model="newRule.operator"
                  class="px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option v-for="op in operatorOptions" :key="op.value" :value="op.value">{{ op.label }}</option>
                </select>
                <input
                  v-model.number="newRule.threshold"
                  type="number"
                  step="any"
                  placeholder="阈值"
                  class="w-24 px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <input
                  v-model="newRule.message"
                  type="text"
                  placeholder="告警描述（可选）"
                  class="flex-1 min-w-[140px] px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  @click="handleAddAlarmRule"
                  class="px-3 py-1.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded transition-colors"
                >
                  添加
                </button>
              </div>
            </div>
            <!-- Rule list -->
            <div v-if="canbus.alarmRules.length === 0" class="text-center py-8 text-gray-500 text-sm">
              暂无告警规则
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="rule in canbus.alarmRules"
                :key="rule.id"
                class="flex items-center gap-3 px-3 py-2 bg-gray-800 rounded border border-gray-700"
              >
                <button
                  @click="handleToggleRule(rule)"
                  class="w-9 h-5 rounded-full transition-colors relative shrink-0"
                  :class="rule.enabled ? 'bg-cyan-600' : 'bg-gray-600'"
                >
                  <span
                    class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform"
                    :class="rule.enabled ? 'translate-x-4' : 'translate-x-0.5'"
                  ></span>
                </button>
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-gray-100 font-mono">
                    {{ rule.signalName }}
                    <span class="text-gray-400 mx-1">{{ operatorOptions.find(o => o.value === rule.operator)?.label }}</span>
                    <span class="text-yellow-300">{{ rule.threshold }}</span>
                  </div>
                  <div v-if="rule.message" class="text-xs text-gray-500 truncate">{{ rule.message }}</div>
                </div>
                <button
                  @click="handleRemoveRule(rule.id)"
                  class="text-red-400 hover:text-red-300 transition-colors shrink-0"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 01-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Vehicles Tab -->
          <div v-if="activeTab === 'vehicles'">
            <p class="text-xs text-gray-500 mb-3">
              管理车辆列表。每辆车可独立关联一套诊断模板，切换车辆后自动应用对应模板。
            </p>
            <!-- Add vehicle form -->
            <div class="bg-gray-800 rounded-lg p-3 mb-4 border border-gray-700">
              <div class="flex flex-wrap items-center gap-2">
                <input
                  v-model="newVehicleName"
                  type="text"
                  placeholder="车辆名称（如：测试车A）"
                  class="flex-1 min-w-[140px] px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <input
                  v-model="newVehicleVin"
                  type="text"
                  placeholder="VIN（可选）"
                  class="flex-1 min-w-[140px] px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  @click="handleAddVehicle"
                  class="px-3 py-1.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded transition-colors"
                >
                  添加车辆
                </button>
              </div>
            </div>
            <!-- Vehicle list -->
            <div v-if="templatesStore.vehicles.length === 0" class="text-center py-8 text-gray-500 text-sm">
              暂无车辆 — 添加车辆后即可在不同车辆间复用诊断模板
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="vehicle in templatesStore.vehicles"
                :key="vehicle.id"
                class="px-3 py-2.5 bg-gray-800 rounded border transition-colors"
                :class="templatesStore.currentVehicleId === vehicle.id ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-700'"
              >
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full shrink-0" :class="templatesStore.currentVehicleId === vehicle.id ? 'bg-cyan-400' : 'bg-gray-600'"></div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-gray-100 font-medium">{{ vehicle.name }}</span>
                      <span v-if="templatesStore.currentVehicleId === vehicle.id" class="text-xs text-cyan-300 px-1.5 py-0.5 bg-cyan-900/50 rounded">当前</span>
                    </div>
                    <div class="text-xs text-gray-500 font-mono truncate">{{ vehicle.vin || '无 VIN' }}</div>
                  </div>
                  <button
                    v-if="templatesStore.currentVehicleId !== vehicle.id"
                    @click="handleSwitchVehicle(vehicle.id)"
                    class="px-2.5 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors shrink-0"
                  >
                    切换
                  </button>
                  <button
                    @click="handleDeleteVehicle(vehicle.id)"
                    class="text-red-400 hover:text-red-300 transition-colors shrink-0"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 01-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div class="mt-2.5 pt-2 border-t border-gray-700 flex items-center gap-2">
                  <span class="text-xs text-gray-500 shrink-0">诊断模板:</span>
                  <select
                    :value="vehicle.activeTemplateId || ''"
                    @change="handleVehicleTemplateChange(vehicle.id, ($event.target as HTMLSelectElement).value)"
                    class="flex-1 min-w-0 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-gray-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">— 无模板 —</option>
                    <option v-for="tpl in templatesStore.templates" :key="tpl.id" :value="tpl.id">{{ tpl.name }}</option>
                  </select>
                  <button
                    v-if="vehicle.activeTemplateId && templatesStore.currentVehicleId === vehicle.id && canbus.activeTemplateId !== vehicle.activeTemplateId"
                    @click="handleApplyVehicleTemplate(vehicle)"
                    class="px-2 py-1 text-xs text-white bg-cyan-600 hover:bg-cyan-700 rounded transition-colors shrink-0"
                  >
                    应用
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-5 py-3 bg-gray-800 border-t border-gray-700">
          <div class="text-xs text-gray-500">
            <span v-if="templatesStore.currentVehicle">
              当前车辆: <span class="text-cyan-400">{{ templatesStore.currentVehicle.name }}</span>
            </span>
            <span v-else class="text-yellow-500">未选择车辆</span>
            <span class="mx-2">·</span>
            <span v-if="templatesStore.currentVehicle">
              模板: <span class="text-cyan-400">{{ getTemplateName(templatesStore.currentVehicle.activeTemplateId) }}</span>
            </span>
            <span v-else>模板数据本地存储，可跨车辆复用</span>
          </div>
          <button
            @click="emit('close')"
            class="px-4 py-1.5 text-sm text-gray-200 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
