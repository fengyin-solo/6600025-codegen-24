import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { DiagnosticTemplate, Vehicle } from '../types';

const TEMPLATES_KEY = 'canbus_diagnostic_templates';
const VEHICLES_KEY = 'canbus_vehicles';
const CURRENT_VEHICLE_KEY = 'canbus_current_vehicle';

const DEFAULT_TEMPLATES: DiagnosticTemplate[] = [
  {
    id: 'default_engine',
    name: '发动机监测套件',
    description: '监测发动机核心参数：转速、负载、水温、节气门位置，包含超温告警',
    filterId: '',
    filterText: '',
    focusSignals: ['EngineRPM', 'EngineLoad', 'CoolantTemp', 'ThrottlePosition'],
    alarmRules: [
      {
        id: 'rule_coolant_high',
        signalName: 'CoolantTemp',
        operator: '>',
        threshold: 105,
        enabled: true,
        message: '冷却液温度过高！'
      },
      {
        id: 'rule_rpm_high',
        signalName: 'EngineRPM',
        operator: '>',
        threshold: 5500,
        enabled: true,
        message: '发动机转速过高'
      }
    ],
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'default_speed',
    name: '车速监测套件',
    description: '专注于车速和相关信号监测',
    filterId: '',
    filterText: 'Speed',
    focusSignals: ['VehicleSpeed', 'ThrottlePosition'],
    alarmRules: [
      {
        id: 'rule_speed_high',
        signalName: 'VehicleSpeed',
        operator: '>',
        threshold: 100,
        enabled: false,
        message: '车速超过限值'
      }
    ],
    createdAt: 0,
    updatedAt: 0
  }
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function initializeTemplates(): DiagnosticTemplate[] {
  const existing = loadFromStorage<DiagnosticTemplate[]>(TEMPLATES_KEY, []);
  if (existing.length > 0) return existing;
  const now = Date.now();
  const defaults = DEFAULT_TEMPLATES.map(t => ({
    ...t,
    id: `tpl_default_${t.id}`,
    createdAt: now,
    updatedAt: now
  }));
  saveToStorage(TEMPLATES_KEY, defaults);
  return defaults;
}

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<DiagnosticTemplate[]>(initializeTemplates());
  const vehicles = ref<Vehicle[]>(loadFromStorage<Vehicle[]>(VEHICLES_KEY, []));
  const currentVehicleId = ref<string | null>(loadFromStorage<string | null>(CURRENT_VEHICLE_KEY, null));

  const currentVehicle = computed(() =>
    vehicles.value.find(v => v.id === currentVehicleId.value) || null
  );

  const hasVehicles = computed(() => vehicles.value.length > 0);

  const currentTemplate = computed(() => {
    if (!currentVehicle.value?.activeTemplateId) return null;
    return templates.value.find(t => t.id === currentVehicle.value!.activeTemplateId) || null;
  });

  function persistTemplates() {
    saveToStorage(TEMPLATES_KEY, templates.value);
  }

  function persistVehicles() {
    saveToStorage(VEHICLES_KEY, vehicles.value);
  }

  function persistCurrentVehicle() {
    saveToStorage(CURRENT_VEHICLE_KEY, currentVehicleId.value);
  }

  function updateVehicle(id: string, patch: Partial<Vehicle>) {
    const idx = vehicles.value.findIndex(v => v.id === id);
    if (idx >= 0) {
      vehicles.value[idx] = { ...vehicles.value[idx], ...patch };
      persistVehicles();
    }
  }

  function saveTemplate(template: DiagnosticTemplate): DiagnosticTemplate {
    const idx = templates.value.findIndex(t => t.id === template.id);
    const now = Date.now();
    if (idx >= 0) {
      const updated = { ...template, updatedAt: now };
      templates.value[idx] = updated;
      persistTemplates();
      return updated;
    }
    const newTemplate: DiagnosticTemplate = {
      ...template,
      id: template.id || generateId('tpl'),
      createdAt: now,
      updatedAt: now
    };
    templates.value.push(newTemplate);
    persistTemplates();
    return newTemplate;
  }

  function deleteTemplate(id: string) {
    templates.value = templates.value.filter(t => t.id !== id);
    persistTemplates();
    for (const v of vehicles.value) {
      if (v.activeTemplateId === id) {
        updateVehicle(v.id, { activeTemplateId: null });
      }
    }
  }

  function getTemplate(id: string): DiagnosticTemplate | undefined {
    return templates.value.find(t => t.id === id);
  }

  function addVehicle(name: string, vin: string): Vehicle {
    const vehicle: Vehicle = {
      id: generateId('veh'),
      name: name.trim() || '未命名车辆',
      vin: vin.trim(),
      activeTemplateId: null,
      createdAt: Date.now()
    };
    vehicles.value.push(vehicle);
    persistVehicles();
    return vehicle;
  }

  function switchVehicle(id: string) {
    if (vehicles.value.some(v => v.id === id)) {
      currentVehicleId.value = id;
      persistCurrentVehicle();
    }
  }

  function setVehicleTemplate(vehicleId: string, templateId: string | null) {
    updateVehicle(vehicleId, { activeTemplateId: templateId });
  }

  function deleteVehicle(id: string) {
    vehicles.value = vehicles.value.filter(v => v.id !== id);
    persistVehicles();
    if (currentVehicleId.value === id) {
      currentVehicleId.value = vehicles.value.length > 0 ? vehicles.value[0].id : null;
      persistCurrentVehicle();
    }
  }

  function resetToDefaults() {
    const now = Date.now();
    const defaults = DEFAULT_TEMPLATES.map(t => ({
      ...t,
      id: `tpl_default_${t.id}`,
      createdAt: now,
      updatedAt: now
    }));
    templates.value = defaults;
    persistTemplates();
  }

  return {
    templates,
    vehicles,
    currentVehicleId,
    currentVehicle,
    currentTemplate,
    hasVehicles,
    saveTemplate,
    deleteTemplate,
    getTemplate,
    addVehicle,
    switchVehicle,
    setVehicleTemplate,
    deleteVehicle,
    resetToDefaults
  };
});
