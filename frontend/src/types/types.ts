export interface Nurse {
  id: string;
  nurse_id: string;
  name: string;
  email: string;
  department: string;
  skill_category: string;
  status: 'Active' | 'Break' | 'Offline' | 'Leave';
  current_fatigue: number;
  device_status: 'Active' | 'Inactive' | 'Disconnected' | 'None';
  work_hours: number;
  last_seen: string;
  max_shift_hours?: number;
}

export interface Telemetry {
  heart_rate: number;
  hrv: number;
  spo2: number;
  gsr_voltage: number;
  skin_temp: number;
}

export interface Predictions {
  predicted_2h: number;
  predicted_4h: number;
  predicted_end_shift: number;
}

export interface TelemetryUpdateMessage {
  type: 'TELEMETRY_UPDATE';
  nurse_id: string;
  nurse_name: string;
  nurse_code: string;
  department: string;
  fatigue_score: number;
  risk_level: 'Normal' | 'Moderate' | 'High' | 'Critical';
  is_anomaly: boolean;
  shift_hours: number;
  telemetry: Telemetry;
  predictions: Predictions;
}

export interface SensorHistoryPoint {
  timestamp: string;
  heart_rate: number;
  hrv: number;
  spo2: number;
  gsr_voltage: number;
  skin_temp: number;
  fatigue_score: number;
}

export interface ReplacementCandidate {
  id: string;
  name: string;
  nurse_id: string;
  department: string;
  skill_category: string;
  fatigue_score: number;
  current_work_hours: number;
  availability_score: number;
  status: string;
  recommendation_rank?: number;
}

export interface ActiveShift {
  id: string;
  nurse_name: string;
  nurse_code: string;
  department: string;
  fatigue_score: number;
  start_time: string;
  end_time: string;
  hours_worked: number;
}

export interface ShiftReplacementHistory {
  id: string;
  timestamp: string;
  original_nurse: string;
  replacement_nurse: string;
  department: string;
  justification: string;
  status: string;
}

export interface Alert {
  id: string;
  nurse_name: string;
  nurse_code: string;
  department: string;
  alert_type: 'Low' | 'High' | 'Critical';
  fatigue_score: number;
  timestamp: string;
  status: string;
  resolved: boolean;
  description: string;
}

export interface ModelMetrics {
  xgboost: { mae: number; rmse: number; r2: number };
  random_forest: { mae: number; rmse: number; r2: number };
  isolation_forest: { accuracy: number; false_positive_rate: number };
  one_class_svm: { accuracy: number; false_positive_rate: number };
  lstm_time_series: { mape: number; rmse: number };
}

export interface ShapValue {
  feature: string;
  value: number;
  description: string;
}

export interface DeviceResponse {
  id: string;
  mac_address: string;
  status: string;
  assigned_nurse_name: string;
  last_seen: string;
}
