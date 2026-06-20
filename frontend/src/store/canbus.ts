import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CanFrame, DbcMessage, BusStats, AlarmRule, AlarmEvent, DiagnosticTemplate } from '../types';
import { parseDbc, decodeCanFrame, DEFAULT_DBC_CONTENT } from '../utils/dbc-parser';

let frameIdCounter = 0;

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function evaluateAlarm(value: number, operator: AlarmRule['operator'], threshold: number): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    case '!=': return value !== threshold;
    default: return false;
  }
}

export const useCanBusStore = defineStore('canbus', () => {
  const frames = ref<CanFrame[]>([]);
  const signals = ref<Map<string, { name: string; data: { time: number; value: number }[] }>>(new Map());
  const dbcMessages = ref<Map<number, DbcMessage>>(new Map());
  const filterId = ref('');
  const filterText = ref('');
  const focusSignals = ref<string[]>([]);
  const alarmRules = ref<AlarmRule[]>([]);
  const activeAlarms = ref<AlarmEvent[]>([]);
  const isCapturing = ref(false);
  const pollInterval = ref<number | null>(null);
  const activeTemplateId = ref<string | null>(null);

  const busStats = ref<BusStats>({
    totalFrames: 0,
    rxCount: 0,
    txCount: 0,
    errorCount: 0,
    busLoad: 0,
    lastUpdate: Date.now()
  });

  const filteredFrames = computed(() => {
    let result = frames.value;

    if (filterId.value.trim()) {
      const idFilter = filterId.value.trim().toLowerCase().replace(/^0x/, '');
      result = result.filter(f =>
        f.arbitrationId.toString(16).toLowerCase().includes(idFilter)
      );
    }

    if (filterText.value.trim()) {
      const textFilter = filterText.value.trim().toLowerCase();
      result = result.filter(f => {
        if (f.arbitrationId.toString(16).toLowerCase().includes(textFilter)) return true;
        if (f.data.toLowerCase().includes(textFilter)) return true;
        for (const key of Object.keys(f.decoded)) {
          if (key.toLowerCase().includes(textFilter)) return true;
        }
        return false;
      });
    }

    return result;
  });

  const busLoadPercent = computed(() => {
    return busStats.value.busLoad.toFixed(1);
  });

  const availableSignals = computed(() => {
    const names = new Set<string>();
    for (const msg of dbcMessages.value.values()) {
      for (const sig of msg.signals) {
        names.add(sig.name);
      }
    }
    for (const frame of frames.value) {
      for (const key of Object.keys(frame.decoded)) {
        names.add(key);
      }
    }
    return Array.from(names).sort();
  });

  const unacknowledgedAlarmCount = computed(() =>
    activeAlarms.value.filter(a => !a.acknowledged).length
  );

  function addFrame(frame: CanFrame) {
    frames.value.push(frame);
    if (frames.value.length > 500) {
      frames.value = frames.value.slice(-500);
    }

    busStats.value.totalFrames++;
    if (frame.direction === 'RX') busStats.value.rxCount++;
    else busStats.value.txCount++;
    busStats.value.lastUpdate = Date.now();

    // Update signal history
    const msgDef = dbcMessages.value.get(frame.arbitrationId);
    if (msgDef) {
      const decoded = decodeCanFrame(frame, msgDef);
      frame.decoded = decoded;
      for (const [name, value] of Object.entries(decoded)) {
        if (!signals.value.has(name)) {
          signals.value.set(name, { name, data: [] });
        }
        const sig = signals.value.get(name)!;
        sig.data.push({ time: frame.timestamp, value });
        if (sig.data.length > 100) {
          sig.data = sig.data.slice(-100);
        }
      }
    }

    // Simulate bus load (random 15-45%)
    busStats.value.busLoad = 15 + Math.random() * 30;

    // Evaluate alarm rules against decoded signals
    for (const rule of alarmRules.value) {
      if (!rule.enabled) continue;
      const value = frame.decoded[rule.signalName];
      if (typeof value !== 'number') continue;
      if (evaluateAlarm(value, rule.operator, rule.threshold)) {
        const existing = activeAlarms.value.find(
          a => a.ruleId === rule.id && !a.acknowledged
        );
        if (!existing) {
          activeAlarms.value.unshift({
            id: generateId('alarm'),
            ruleId: rule.id,
            ruleName: rule.message || `${rule.signalName} ${rule.operator} ${rule.threshold}`,
            signalName: rule.signalName,
            operator: rule.operator,
            threshold: rule.threshold,
            actualValue: value,
            message: rule.message,
            timestamp: Date.now(),
            acknowledged: false
          });
          if (activeAlarms.value.length > 50) {
            activeAlarms.value = activeAlarms.value.slice(0, 50);
          }
        }
      }
    }
  }

  function clearFrames() {
    frames.value = [];
    signals.value = new Map();
    busStats.value = {
      totalFrames: 0,
      rxCount: 0,
      txCount: 0,
      errorCount: 0,
      busLoad: 0,
      lastUpdate: Date.now()
    };
    frameIdCounter = 0;
  }

  function loadMockDbc() {
    parseAndLoadDbc(DEFAULT_DBC_CONTENT);
  }

  function parseAndLoadDbc(text: string) {
    dbcMessages.value = parseDbc(text);
  }

  function generateMockFrame(): CanFrame {
    const messageIds = Array.from(dbcMessages.value.keys());
    const arbId = messageIds.length > 0
      ? messageIds[Math.floor(Math.random() * messageIds.length)]
      : 0x7DF;

    const msgDef = dbcMessages.value.get(arbId);

    // Generate realistic OBD-II values
    const rpm = Math.floor(800 + Math.random() * 5200);
    const speed = Math.floor(Math.random() * 120);
    const temp = Math.floor(70 + Math.random() * 35);
    const throttle = Math.floor(Math.random() * 100);
    const load = Math.floor(Math.random() * 100);

    // Encode values into bytes (simplified encoding for display)
    const rpmRaw = Math.round(rpm / 0.25);
    const rpmLow = rpmRaw & 0xFF;
    const rpmHigh = (rpmRaw >> 8) & 0xFF;
    const speedByte = speed & 0xFF;
    const tempByte = (temp + 40) & 0xFF;
    const throttleByte = Math.round(throttle / 0.392) & 0xFF;
    const loadByte = Math.round(load / 0.392) & 0xFF;

    const dataBytes = [rpmLow, rpmHigh, speedByte, tempByte, throttleByte, loadByte, 0x00, 0x00];
    const dataHex = dataBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    const frame: CanFrame = {
      id: `frame-${++frameIdCounter}`,
      timestamp: Date.now(),
      arbitrationId: arbId,
      dlc: 8,
      data: dataHex,
      decoded: {},
      direction: Math.random() > 0.3 ? 'RX' : 'TX'
    };

    if (msgDef) {
      frame.decoded = {
        EngineRPM: rpm,
        VehicleSpeed: speed,
        CoolantTemp: temp,
        ThrottlePosition: throttle,
        EngineLoad: load
      };
    }

    return frame;
  }

  function startCapture() {
    if (isCapturing.value) return;
    isCapturing.value = true;

    // Load mock DBC if not loaded
    if (dbcMessages.value.size === 0) {
      loadMockDbc();
    }

    pollInterval.value = window.setInterval(() => {
      const frame = generateMockFrame();
      addFrame(frame);
    }, 200);
  }

  function stopCapture() {
    isCapturing.value = false;
    if (pollInterval.value !== null) {
      clearInterval(pollInterval.value);
      pollInterval.value = null;
    }
  }

  function decodeFrame(frame: CanFrame): Record<string, number> {
    const msgDef = dbcMessages.value.get(frame.arbitrationId);
    if (!msgDef) return {};
    return decodeCanFrame(frame, msgDef);
  }

  function exportFrames(): string {
    const header = 'Timestamp,Direction,CAN_ID,DLC,Data,Decoded\n';
    const rows = frames.value.map(f => {
      const decodedStr = Object.entries(f.decoded)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      return `${f.timestamp},${f.direction},0x${f.arbitrationId.toString(16).toUpperCase()},${f.dlc},"${f.data}","${decodedStr}"`;
    }).join('\n');
    return header + rows;
  }

  function applyTemplate(template: DiagnosticTemplate) {
    filterId.value = template.filterId;
    filterText.value = template.filterText;
    focusSignals.value = [...template.focusSignals];
    alarmRules.value = template.alarmRules.map(r => ({ ...r }));
    activeTemplateId.value = template.id;
  }

  function clearTemplateState() {
    filterId.value = '';
    filterText.value = '';
    focusSignals.value = [];
    alarmRules.value = [];
    activeTemplateId.value = null;
    activeAlarms.value = [];
  }

  function buildTemplateFromCurrent(name: string, description: string): DiagnosticTemplate {
    return {
      id: '',
      name: name.trim() || '未命名模板',
      description: description.trim(),
      filterId: filterId.value,
      filterText: filterText.value,
      focusSignals: [...focusSignals.value],
      alarmRules: alarmRules.value.map(r => ({ ...r })),
      createdAt: 0,
      updatedAt: 0
    };
  }

  function toggleFocusSignal(name: string) {
    const idx = focusSignals.value.indexOf(name);
    if (idx >= 0) {
      focusSignals.value = focusSignals.value.filter(s => s !== name);
    } else {
      focusSignals.value = [...focusSignals.value, name];
    }
  }

  function addAlarmRule(rule: Omit<AlarmRule, 'id'>): AlarmRule {
    const newRule: AlarmRule = { ...rule, id: generateId('rule') };
    alarmRules.value = [...alarmRules.value, newRule];
    return newRule;
  }

  function updateAlarmRule(id: string, patch: Partial<AlarmRule>) {
    alarmRules.value = alarmRules.value.map(r =>
      r.id === id ? { ...r, ...patch } : r
    );
  }

  function removeAlarmRule(id: string) {
    alarmRules.value = alarmRules.value.filter(r => r.id !== id);
    activeAlarms.value = activeAlarms.value.filter(a => a.ruleId !== id);
  }

  function acknowledgeAlarm(id: string) {
    activeAlarms.value = activeAlarms.value.map(a =>
      a.id === id ? { ...a, acknowledged: true } : a
    );
  }

  function acknowledgeAllAlarms() {
    activeAlarms.value = activeAlarms.value.map(a => ({ ...a, acknowledged: true }));
  }

  function clearAlarms() {
    activeAlarms.value = [];
  }

  return {
    frames,
    signals,
    dbcMessages,
    filterId,
    filterText,
    focusSignals,
    alarmRules,
    activeAlarms,
    activeTemplateId,
    busStats,
    isCapturing,
    filteredFrames,
    busLoadPercent,
    availableSignals,
    unacknowledgedAlarmCount,
    addFrame,
    clearFrames,
    loadMockDbc,
    parseAndLoadDbc,
    startCapture,
    stopCapture,
    decodeFrame,
    exportFrames,
    applyTemplate,
    clearTemplateState,
    buildTemplateFromCurrent,
    toggleFocusSignal,
    addAlarmRule,
    updateAlarmRule,
    removeAlarmRule,
    acknowledgeAlarm,
    acknowledgeAllAlarms,
    clearAlarms
  };
});
