import React, { useEffect, useState } from 'react';
import { ModelMetrics } from '../types/types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { 
  BrainCircuit, 
  Cpu, 
  LineChart as LineIcon, 
  Activity, 
  Compass,
  CheckCircle2,
  ListCollapse
} from 'lucide-react';

export const Analytics: React.FC = () => {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/ml/metrics')
      .then(res => res.json())
      .then(data => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading ML metrics:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
          <p className="text-sm text-slate-500 font-semibold">Loading AI Analytics Pipeline...</p>
        </div>
      </div>
    );
  }

  // Feature Importance average weights data
  const featureImportanceData = [
    { name: 'GSR Stress', Weight: 0.35, color: '#f43f5e' },
    { name: 'Sleep Debt', Weight: 0.30, color: '#0ea5e9' },
    { name: 'HRV Index', Weight: 0.20, color: '#10b981' },
    { name: 'Skin Temp Var', Weight: 0.10, color: '#f59e0b' },
    { name: 'Act Variance', Weight: 0.05, color: '#8b5cf6' }
  ];

  // Radar chart showing model performance comparisons
  const radarData = [
    { subject: 'HRV SDNN', A: 85, B: 90, fullMark: 100 },
    { subject: 'GSR Sweat', A: 92, B: 85, fullMark: 100 },
    { subject: 'Sleep debt', A: 78, B: 95, fullMark: 100 },
    { subject: 'Temp drift', A: 90, B: 80, fullMark: 100 },
    { subject: 'Motion var', A: 88, B: 82, fullMark: 100 }
  ];

  return (
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">Machine Learning Analytics</h2>
        <p className="text-sm text-slate-500">Evaluation summaries, SHAP weights, and training metrics of prediction engines.</p>
      </div>

      {metrics && (
        <>
          {/* Models Accuracies Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">XGBoost Regressor</span>
                <Cpu size={18} className="text-rose-500" />
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-bold text-slate-900">R² = {metrics.xgboost.r2}</h3>
                <div className="flex gap-4 mt-2 text-xs text-slate-500 font-semibold">
                  <span>MAE: {metrics.xgboost.mae}</span>
                  <span>RMSE: {metrics.xgboost.rmse}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Random Forest</span>
                <Cpu size={18} className="text-sky-500" />
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-bold text-slate-900">R² = {metrics.random_forest.r2}</h3>
                <div className="flex gap-4 mt-2 text-xs text-slate-500 font-semibold">
                  <span>MAE: {metrics.random_forest.mae}</span>
                  <span>RMSE: {metrics.random_forest.rmse}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Isolation Forest</span>
                <BrainCircuit size={18} className="text-teal-500" />
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-bold text-slate-900">Acc = {metrics.isolation_forest.accuracy * 100}%</h3>
                <div className="mt-2 text-xs text-slate-500 font-semibold">
                  <span>FPR: {metrics.isolation_forest.false_positive_rate * 100}% (Anomalies)</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">LSTM Time-Series</span>
                <LineIcon size={18} className="text-violet-500" />
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-bold text-slate-900">RMSE = {metrics.lstm_time_series.rmse}</h3>
                <div className="mt-2 text-xs text-slate-500 font-semibold">
                  <span>MAPE: {metrics.lstm_time_series.mape}% (2h / 4h forecasts)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Area */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Feature Importance Bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                <Activity size={16} className="text-sky-500" /> Global Feature Importance (XGBoost weights)
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={featureImportanceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} domain={[0, 0.4]} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={80} />
                    <Tooltip />
                    <Bar dataKey="Weight" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar coverage */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                <Compass size={16} className="text-teal-600" /> Model Target Sensitivity
              </h4>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" fontSize={10} stroke="#64748b" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={8} />
                    <Radar name="XGBoost" dataKey="A" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.4} />
                    <Radar name="RF" dataKey="B" stroke="#0d9488" fill="#0d9488" fillOpacity={0.2} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Model Preprocessing Flow */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
          <ListCollapse size={18} className="text-slate-500" />
          AI/ML Data Engineering & Training Pipeline
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="rounded-lg border border-slate-100 p-4 bg-slate-50">
            <span className="font-bold text-sky-600 block mb-1">Step 1: Noise Filtering</span>
            <p className="text-slate-500 leading-relaxed">
              PPG signals run through median filters to discard movement artifact peaks. GSR levels pass moving-average filters to isolate low-frequency drift.
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 p-4 bg-slate-50">
            <span className="font-bold text-teal-600 block mb-1">Step 2: Baseline Calibration</span>
            <p className="text-slate-500 leading-relaxed">
              Sensors scale values dynamically according to individual nurse rest parameters, calculating Z-score normalization for accurate cross-subject assessment.
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 p-4 bg-slate-50">
            <span className="font-bold text-violet-600 block mb-1">Step 3: Feature Engineering</span>
            <p className="text-slate-500 leading-relaxed">
              Extraction of SDNN intervals (HRV Index), galvanic peaks (Stress Score), sleep deficit tracking, and 3D accelerometer variance coefficients.
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 p-4 bg-slate-50">
            <span className="font-bold text-rose-600 block mb-1">Step 4: Real-Time Inference</span>
            <p className="text-slate-500 leading-relaxed">
              Ensemble voting via XGBoost & Random Forest estimates continuous fatigue (0-100). LSTM analyzes sequence windows for shift trajectory projections.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Analytics;
