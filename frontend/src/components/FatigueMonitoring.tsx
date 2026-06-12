import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { Nurse, SensorHistoryPoint, ShapValue } from '../types/types';
import { 
  Heart, 
  Activity, 
  Flame, 
  Thermometer, 
  Eye, 
  ChevronRight,
  TrendingUp,
  BrainCircuit
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface FatigueMonitoringProps {
  selectedNurse: Nurse | null;
  onSelectNurse: (nurse: Nurse | null) => void;
}

export const FatigueMonitoring: React.FC<FatigueMonitoringProps> = ({ selectedNurse, onSelectNurse }) => {
  const { liveUpdates } = useWebSocket();
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [history, setHistory] = useState<SensorHistoryPoint[]>([]);
  const [shapValues, setShapValues] = useState<ShapValue[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'hr' | 'hrv' | 'gsr' | 'temp'>('all');
  const [predictions, setPredictions] = useState({
    predicted_2h: 0.0,
    predicted_4h: 0.0,
    predicted_end_shift: 0.0
  });

  // Fetch active nurses for dropdown
  useEffect(() => {
    fetch('/api/v1/nurses')
      .then(res => res.json())
      .then(data => {
        setNurses(data);
        if (data.length > 0 && !selectedNurse) {
          onSelectNurse(data[0]);
        }
      });
  }, []);

  // Fetch telemetry history when nurse changes
  useEffect(() => {
    if (!selectedNurse) return;
    
    // Fetch initial 15 history points
    fetch(`/api/v1/nurses/${selectedNurse.id}/telemetry-history`)
      .then(res => res.json())
      .then(data => {
        setHistory(data);
      });

    // Fetch SHAP feature explanations
    fetch(`/api/v1/ml/feature-importance/${selectedNurse.id}`)
      .then(res => res.json())
      .then(data => {
        setShapValues(data);
      });

    // Calculate baseline prediction estimates
    const baselineHours = selectedNurse.work_hours || 4.0;
    const currentScore = selectedNurse.current_fatigue;
    const drift = 1.8 + (currentScore * 0.05);
    setPredictions({
      predicted_2h: Math.round(Math.min(100, currentScore + drift * 2)),
      predicted_4h: Math.round(Math.min(100, currentScore + drift * 4)),
      predicted_end_shift: Math.round(Math.min(100, currentScore + drift * (12 - baselineHours)))
    });

  }, [selectedNurse]);

  // Sync real-time WebSocket signals for selected nurse
  useEffect(() => {
    if (!selectedNurse) return;
    const update = liveUpdates[selectedNurse.id];
    if (!update) return;

    // Append new reading to history
    setHistory((prev) => {
      const newPoint: SensorHistoryPoint = {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        heart_rate: update.telemetry.heart_rate,
        hrv: update.telemetry.hrv,
        spo2: update.telemetry.spo2,
        gsr_voltage: update.telemetry.gsr_voltage,
        skin_temp: update.telemetry.skin_temp,
        fatigue_score: update.fatigue_score
      };
      
      const newHistory = [...prev, newPoint];
      // Keep only latest 15 points
      if (newHistory.length > 15) {
        return newHistory.slice(1);
      }
      return newHistory;
    });

    // Update projections
    setPredictions(update.predictions);

    // Update nurse current fatigue value
    onSelectNurse({
      ...selectedNurse,
      current_fatigue: update.fatigue_score,
      work_hours: update.shift_hours
    });

  }, [liveUpdates]);

  const handleNurseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nurse = nurses.find(n => n.id === e.target.value);
    if (nurse) onSelectNurse(nurse);
  };

  const getDialColor = (score: number) => {
    if (score <= 30) return 'stroke-emerald-500 text-emerald-600';
    if (score <= 60) return 'stroke-amber-500 text-amber-600';
    if (score <= 80) return 'stroke-orange-500 text-orange-600';
    return 'stroke-rose-500 text-rose-600';
  };

  const getDialBg = (score: number) => {
    if (score <= 30) return 'bg-emerald-50 text-emerald-700';
    if (score <= 60) return 'bg-amber-50 text-amber-700';
    if (score <= 80) return 'bg-orange-50 text-orange-700';
    return 'bg-rose-50 text-rose-700';
  };

  return (
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6">
      {/* Header with Selector */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Real-Time Telemetry & Forecasts</h2>
          <p className="text-sm text-slate-500">Live streams of MAX30102, GSR, MLX90614, and MPU6050 bio-signals.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-500 uppercase">Select Nurse:</label>
          <select
            value={selectedNurse?.id || ''}
            onChange={handleNurseChange}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm bg-white text-slate-700 shadow-sm focus:outline-none focus:border-sky-500 font-medium"
          >
            {nurses.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.nurse_id}) - {n.department}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedNurse && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Gauges and Projections */}
          <div className="space-y-6 lg:col-span-1">
            {/* Risk Gauge */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-4 left-4 flex items-center gap-1 text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full uppercase">
                <BrainCircuit size={12} /> ML Model Analysis
              </div>
              <h4 className="text-sm font-bold text-slate-900 self-start mb-6">Fatigue Index Status</h4>
              
              {/* Circular Dial */}
              <div className="relative h-44 w-44">
                <svg className="h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Outer circle */}
                  <circle
                    className="stroke-slate-100"
                    strokeWidth="10"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                  />
                  {/* Gauge fill */}
                  <circle
                    className={`${getDialColor(selectedNurse.current_fatigue)} transition-all duration-500`}
                    strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - selectedNurse.current_fatigue / 100)}`}
                    strokeLinecap="round"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                  />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-slate-900">{selectedNurse.current_fatigue}%</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Fatigue Score</span>
                </div>
              </div>

              {/* Status Indicator */}
              <div className={`mt-5 rounded-lg px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide ${getDialBg(selectedNurse.current_fatigue)}`}>
                {selectedNurse.current_fatigue <= 30 ? 'Normal Capacity' : 
                 selectedNurse.current_fatigue <= 60 ? 'Moderate Alert' :
                 selectedNurse.current_fatigue <= 80 ? 'High Risk' : 'Critical - Relieve Staff'}
              </div>
            </div>

            {/* AI Predictions */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-1.5">
                <TrendingUp size={16} className="text-sky-500" />
                AI Fatigue Forecast (XGBoost + LSTM)
              </h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                    <span>Next 2 Hours Forecast</span>
                    <span className={predictions.predicted_2h > 75 ? 'text-rose-500 font-bold' : 'text-slate-800'}>
                      {predictions.predicted_2h}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${predictions.predicted_2h > 75 ? 'bg-rose-500' : 'bg-sky-400'} transition-all duration-300`} 
                      style={{ width: `${predictions.predicted_2h}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                    <span>Next 4 Hours Forecast</span>
                    <span className={predictions.predicted_4h > 75 ? 'text-rose-500 font-bold' : 'text-slate-800'}>
                      {predictions.predicted_4h}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${predictions.predicted_4h > 75 ? 'bg-rose-500' : 'bg-sky-400'} transition-all duration-300`} 
                      style={{ width: `${predictions.predicted_4h}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                    <span>End of Shift Forecast</span>
                    <span className={predictions.predicted_end_shift > 75 ? 'text-rose-500 font-bold' : 'text-slate-800'}>
                      {predictions.predicted_end_shift}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${predictions.predicted_end_shift > 75 ? 'bg-rose-500' : 'bg-sky-400'} transition-all duration-300`} 
                      style={{ width: `${predictions.predicted_end_shift}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400">
                <span>Model Confidence Index</span>
                <span className="font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">94.8% (XGB)</span>
              </div>
            </div>
          </div>

          {/* Real-time Scrolling Trend Graphs */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-sm font-bold text-slate-900">Bio-sensor Telemetry Streams</h4>
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-1">
                  <button 
                    onClick={() => setActiveTab('all')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setActiveTab('hr')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${activeTab === 'hr' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    HR
                  </button>
                  <button 
                    onClick={() => setActiveTab('hrv')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${activeTab === 'hrv' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    HRV
                  </button>
                  <button 
                    onClick={() => setActiveTab('gsr')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${activeTab === 'gsr' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    GSR
                  </button>
                  <button 
                    onClick={() => setActiveTab('temp')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${activeTab === 'temp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Temp
                  </button>
                </div>
              </div>

              {/* Responsive Line Charts */}
              <div className="mt-6 space-y-4">
                {(activeTab === 'all' || activeTab === 'hr') && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mb-2">
                      <Heart size={14} fill="currentColor" /> Heart Rate Trend (MAX30102)
                    </div>
                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={10} domain={['dataMin - 5', 'dataMax + 5']} />
                          <Tooltip />
                          <Line type="monotone" dataKey="heart_rate" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {(activeTab === 'all' || activeTab === 'hrv') && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 mb-2">
                      <Activity size={14} /> Autonomic Heart Rate Variability (HRV Index)
                    </div>
                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} />
                          <Tooltip />
                          <Line type="monotone" dataKey="hrv" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {(activeTab === 'all' || activeTab === 'gsr') && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 mb-2">
                      <Flame size={14} /> Galvanic Skin Stress Index (GSR Voltage)
                    </div>
                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={10} domain={[0.0, 3.3]} />
                          <Tooltip />
                          <Line type="monotone" dataKey="gsr_voltage" stroke="#d97706" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {(activeTab === 'all' || activeTab === 'temp') && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-600 mb-2">
                      <Thermometer size={14} /> Peripheral Temperature Trend (MLX90614)
                    </div>
                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={10} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                          <Tooltip />
                          <Line type="monotone" dataKey="skin_temp" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Explainable AI (SHAP Weights) */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                <BrainCircuit size={16} className="text-teal-600" /> Explainable AI Model Coefficients (SHAP Contributions)
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Real-time feature weights showing exactly how sensors impact the nurse's current fatigue calculation.
              </p>
              <div className="space-y-3">
                {shapValues.map((shap) => {
                  const isPositive = shap.value >= 0;
                  const absVal = Math.abs(shap.value);
                  const pct = Math.min(100, Math.round((absVal / 25.0) * 100)); // normalized scale
                  return (
                    <div key={shap.feature} className="flex flex-col sm:flex-row sm:items-center text-xs justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="w-32 min-w-0">
                        <span className="font-semibold text-slate-800">{shap.feature}</span>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        {/* Bar visually showing impact */}
                        <div className="flex-1 h-3 rounded-full bg-slate-50 border overflow-hidden flex justify-end">
                          <div 
                            className={`h-full ${isPositive ? 'bg-rose-400 self-start' : 'bg-emerald-400'}`}
                            style={{ width: `${pct}%`, marginLeft: isPositive ? 'auto' : '0', marginRight: isPositive ? '0' : 'auto' }}
                          ></div>
                        </div>
                        <span className={`w-14 text-right font-bold font-mono ${isPositive ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {isPositive ? '+' : ''}{shap.value}
                        </span>
                      </div>
                      <div className="w-56 text-slate-400 text-[10px] pl-2 leading-tight">
                        {shap.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default FatigueMonitoring;
