export interface CanFrame {
  id: string;
  timestamp: number;
  arbitrationId: number;
  dlc: number;
  data: string;
  decoded: Record<string, number>;
  direction: 'RX' | 'TX';
}

export interface DbcSignal {
  name: string;
  startBit: number;
  bitLength: number;
  factor: number;
  offset: number;
  unit: string;
  minValue: number;
  maxValue: number;
  messageId: number;
}

export interface DbcMessage {
  id: number;
  name: string;
  dlc: number;
  sender: string;
  signals: DbcSignal[];
}

export interface BusStats {
  totalFrames: number;
  rxCount: number;
  txCount: number;
  errorCount: number;
  busLoad: number;
  lastUpdate: number;
}

export type AlarmOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

export interface AlarmRule {
  id: string;
  signalName: string;
  operator: AlarmOperator;
  threshold: number;
  enabled: boolean;
  message: string;
}

export interface DiagnosticTemplate {
  id: string;
  name: string;
  description: string;
  filterId: string;
  filterText: string;
  focusSignals: string[];
  alarmRules: AlarmRule[];
  createdAt: number;
  updatedAt: number;
}

export interface Vehicle {
  id: string;
  name: string;
  vin: string;
  activeTemplateId: string | null;
  createdAt: number;
}

export interface AlarmEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  signalName: string;
  operator: AlarmOperator;
  threshold: number;
  actualValue: number;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}
