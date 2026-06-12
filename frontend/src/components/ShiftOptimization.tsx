import React, { useEffect, useState } from 'react';
import { ActiveShift, ShiftReplacementHistory } from '../types/types';
import { 
  Calendar, 
  History, 
  Clock, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export const ShiftOptimization: React.FC = () => {
  const [activeShifts, setActiveShifts] = useState<ActiveShift[]>([]);
  const [historyLogs, setHistoryLogs] = useState<ShiftReplacementHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState<ShiftReplacementHistory | null>(null);

  const fetchData = async () => {
    try {
      const [aRes, hRes] = await Promise.all([
        fetch('/api/v1/shifts/active'),
        fetch('/api/v1/shifts/history')
      ]);
      const aData = await aRes.json();
      const hData = await hRes.json();
      
      setActiveShifts(aData);
      setHistoryLogs(hData);
      if (hData.length > 0 && !selectedHistory) {
        setSelectedHistory(hData[0]);
      }
    } catch (err) {
      console.error("Error loading shifts optimization details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
          <p className="text-sm text-slate-500 font-semibold">Analyzing Scheduling Timelines...</p>
        </div>
      </div>
    );
  }

  // Pre-process shift chart data: compare hours worked across active shifts
  const shiftChartData = activeShifts.map(s => ({
    name: s.nurse_name.split(' ')[0],
    Hours: s.hours_worked,
    Limit: 12.0
  }));

  return (
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Workforce Optimization Ledger</h2>
          <p className="text-sm text-slate-500">Visual timelines and history of real-time schedule modifications.</p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active Shifts Telemetry */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
            <Clock size={16} className="text-sky-500" /> Active Roster Telemetry
          </h4>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {activeShifts.length > 0 ? (
              activeShifts.map((s) => (
                <div key={s.id} className="rounded-lg border border-slate-100 p-3 bg-slate-50/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-semibold text-slate-900 text-xs">{s.nurse_name}</h5>
                      <span className="text-[10px] text-slate-400 font-medium">{s.department} • {s.nurse_code}</span>
                    </div>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      s.fatigue_score >= 75 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {s.fatigue_score}% Fatigue
                    </span>
                  </div>
                  
                  {/* Hours progress */}
                  <div className="mt-3 flex justify-between text-[10px] text-slate-500 font-medium">
                    <span>Work Duration</span>
                    <span>{s.hours_worked} / 12h</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 mt-1 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${s.fatigue_score >= 75 ? 'bg-rose-500' : 'bg-sky-500'}`}
                      style={{ width: `${(s.hours_worked / 12.0) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No active shifts registered in the system.
              </div>
            )}
          </div>
        </div>

        {/* Before/After Visual Timeline Comparison */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            <Calendar size={16} className="text-sky-500" />
            Roster Timeline Optimization Comparison
          </h4>
          <p className="text-xs text-slate-500 mb-5">
            Interactive representation of schedule adjustments. Select a history item below to visualize.
          </p>

          {selectedHistory ? (
            <div className="space-y-6 border border-slate-100 rounded-lg p-5 bg-slate-50/50">
              <div className="flex justify-between items-center bg-white border border-slate-200/60 p-3 rounded-lg text-xs shadow-sm">
                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[9px]">Department</span>
                  <span className="font-bold text-slate-900">{selectedHistory.department}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[9px]">Swap Time</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedHistory.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-bold text-[9px]">Optimization Status</span>
                  <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase text-[9px] flex items-center gap-0.5">
                    <ShieldCheck size={10} /> Active
                  </span>
                </div>
              </div>

              {/* Timeline diagram */}
              <div className="space-y-5">
                {/* Before Swap Timeline */}
                <div>
                  <h5 className="text-xs font-bold text-slate-800 mb-2">1. Roster Before Optimization</h5>
                  <div className="relative border rounded-lg bg-white p-3 flex flex-col justify-center h-12 shadow-sm border-rose-200">
                    <div className="absolute inset-0 bg-rose-50/30 flex items-center px-4">
                      <div className="text-xs font-semibold text-rose-700 truncate">
                        🚨 {selectedHistory.original_nurse} (Assigned to continuous 12-hour high-risk shift)
                      </div>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 mt-6 z-10 font-bold">
                      <span>07:00 AM (Start)</span>
                      <span>19:00 PM (End)</span>
                    </div>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="flex justify-center text-slate-400">
                  <ArrowRight size={20} className="transform rotate-90" />
                </div>

                {/* After Swap Timeline */}
                <div>
                  <h5 className="text-xs font-bold text-slate-800 mb-2">2. Roster After Optimization (Dynamic Mitigation)</h5>
                  <div className="border rounded-lg bg-white p-3 shadow-sm border-emerald-200">
                    {/* Visual combined timeline block */}
                    <div className="h-6 w-full rounded-md overflow-hidden flex text-[10px] font-semibold text-white">
                      <div className="bg-rose-400 h-full flex items-center justify-center px-2" style={{ width: '40%' }}>
                        {selectedHistory.original_nurse.split(' ')[0]} (Shortened)
                      </div>
                      <div className="bg-emerald-500 h-full flex items-center justify-center px-2 border-l border-white" style={{ width: '60%' }}>
                        {selectedHistory.replacement_nurse.split(' ')[0]} (Assigned remaining roster)
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-[9px] text-slate-400 mt-2 font-bold">
                      <span>07:00 AM</span>
                      <span>11:30 AM (Fatigue Threshold Swapped)</span>
                      <span>19:00 PM</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Justification quote */}
              <div className="border-l-4 border-sky-500 pl-4 py-1.5 bg-sky-50/50 rounded-r-lg">
                <span className="text-[10px] font-bold text-sky-600 uppercase block tracking-wider">Log Justification:</span>
                <p className="text-xs text-sky-900 font-medium italic mt-1">"{selectedHistory.justification}"</p>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-xs text-slate-400">
              No roster modifications logged yet. Timelines will populate when staff replacement cycles occur.
            </div>
          )}
        </div>
      </div>

      {/* Roster Optimization History Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 p-5">
          <History size={18} className="text-slate-500" />
          <h4 className="text-sm font-bold text-slate-900"> Roster Adjustment Audit Trails</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3.5">Log Timestamp</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Relieved Nurse (Fatigued)</th>
                <th className="px-6 py-3.5">Substitute Nurse (Standby)</th>
                <th className="px-6 py-3.5">Justification Details</th>
                <th className="px-6 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyLogs.length > 0 ? (
                historyLogs.map((log) => {
                  const isSelected = selectedHistory?.id === log.id;
                  return (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedHistory(log)}
                      className={`cursor-pointer hover:bg-slate-50/50 transition ${isSelected ? 'bg-sky-50/30 font-medium' : ''}`}
                    >
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {log.department}
                      </td>
                      <td className="px-6 py-4 text-rose-600 font-semibold">
                        {log.original_nurse}
                      </td>
                      <td className="px-6 py-4 text-emerald-600 font-semibold">
                        {log.replacement_nurse}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate" title={log.justification}>
                        {log.justification}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-bold border border-emerald-100">
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    No workforce adjustments have been logged in the current roster period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Shift Utilization Analysis (Recharts) */}
      {activeShifts.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-teal-600" /> Shift Utilization & Hour Allocation limits
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shiftChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} label={{ value: 'Hours Worked', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="Hours" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
export default ShiftOptimization;
