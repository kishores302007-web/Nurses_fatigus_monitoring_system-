import React, { useEffect, useState } from 'react';
import { Nurse } from '../types/types';
import {
  History,
  Calendar,
  Clock,
  ArrowRightLeft,
  User,
  ShieldAlert,
  Search,
  Activity,
  CheckCircle2,
  CalendarDays,
  AlertCircle,
  TrendingDown,
  RotateCw,
  Hourglass
} from 'lucide-react';

interface ShiftItem {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  hours_worked: number;
  department: string;
}

interface ReplacementItem {
  id: string;
  timestamp: string;
  original_nurse: string;
  replacement_nurse: string;
  department: string;
  justification: string;
  status: string;
  role: 'Replaced' | 'Replacing';
}

interface ShiftHistoryData {
  nurse: Nurse;
  history: ShiftItem[];
  upcoming: ShiftItem[];
  replacements: ReplacementItem[];
}

export const HistoryDashboard: React.FC = () => {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [selectedNurseId, setSelectedNurseId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [loadingNurses, setLoadingNurses] = useState<boolean>(false);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyData, setHistoryData] = useState<ShiftHistoryData | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'replacements' | 'upcoming'>('history');
  
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 1. Fetch nurses on load
  const fetchNursesList = async () => {
    setLoadingNurses(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/nurses');
      if (res.ok) {
        const data = await res.json();
        // Sort nurses alphabetically by name
        const sorted = data.sort((a: Nurse, b: Nurse) => a.name.localeCompare(b.name));
        setNurses(sorted);
        
        // Auto-select first nurse if none is selected
        if (sorted.length > 0 && !selectedNurseId) {
          setSelectedNurseId(sorted[0].id);
        }
      } else {
        setErrorMsg('Failed to load clinician list.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Could not connect to API server.');
    } finally {
      setLoadingNurses(false);
    }
  };

  // 2. Fetch shift history for selected nurse
  const fetchShiftHistory = async (nurseId: string) => {
    if (!nurseId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/v1/nurses/${nurseId}/shift-history`);
      if (res.ok) {
        const data: ShiftHistoryData = await res.json();
        setHistoryData(data);
      } else {
        console.error('Failed to load history details.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchNursesList();
  }, []);

  useEffect(() => {
    if (selectedNurseId) {
      fetchShiftHistory(selectedNurseId);
    }
  }, [selectedNurseId]);

  // Filter nurses list based on search query
  const filteredNurses = nurses.filter(n =>
    n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.nurse_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">Completed</span>;
      case 'Active':
        return <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700 border border-sky-200 animate-pulse">Active</span>;
      case 'Replaced':
        return <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">Replaced</span>;
      case 'Scheduled':
        return <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">Scheduled</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' });
  };

  const getFatigueRiskColor = (score: number) => {
    if (score >= 75) return 'text-rose-600 font-extrabold';
    if (score >= 50) return 'text-amber-600 font-bold';
    return 'text-emerald-600 font-bold';
  };

  return (
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <History className="text-sky-500" size={24} /> Clinician Roster & Shift History
          </h2>
          <p className="text-sm text-slate-500">Track and review past performance, active workloads, fatigue-triggered replacement logs, and upcoming duties.</p>
        </div>
        <button
          onClick={fetchNursesList}
          disabled={loadingNurses || loadingHistory}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <RotateCw size={14} className={loadingNurses || loadingHistory ? 'animate-spin' : ''} />
          Sync Roster
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle size={16} /> {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {/* Clinician Selector Panel (Left) */}
        <div className="xl:col-span-1 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col h-[650px]">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User size={14} /> Search Clinician
            </h4>
            
            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Name, ID, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition"
              />
            </div>

            {/* Clinician List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingNurses ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                  <RotateCw className="animate-spin text-sky-500" size={24} />
                  <span className="text-xs">Loading clinician directory...</span>
                </div>
              ) : filteredNurses.length > 0 ? (
                filteredNurses.map((n) => {
                  const isSelected = n.id === selectedNurseId;
                  return (
                    <button
                      key={n.id}
                      onClick={() => setSelectedNurseId(n.id)}
                      className={`w-full text-left rounded-lg p-3 border transition-all duration-200 ${
                        isSelected
                          ? 'bg-sky-50/70 border-sky-300 shadow-xs'
                          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h6 className="font-bold text-slate-900 text-xs">{n.name}</h6>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{n.nurse_id} • {n.department}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          n.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                          n.status === 'Break' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {n.status}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-center py-10 text-xs text-slate-400">No clinicians found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Shift Logs Workspace (Right) */}
        <div className="xl:col-span-3 space-y-6">
          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-40 border border-slate-200 bg-white rounded-xl shadow-sm gap-2">
              <RotateCw className="animate-spin text-sky-500" size={32} />
              <span className="text-sm font-semibold text-slate-500">Loading audit history...</span>
            </div>
          ) : historyData ? (
            <>
              {/* Nurse Summary Header Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-900">{historyData.nurse.name}</h3>
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">{historyData.nurse.nurse_id}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {historyData.nurse.skill_category} • {historyData.nurse.email}
                  </p>
                  <div className="mt-3 flex items-center gap-2.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      historyData.nurse.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      historyData.nurse.status === 'Break' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        historyData.nurse.status === 'Active' ? 'bg-emerald-500 animate-pulse' :
                        historyData.nurse.status === 'Break' ? 'bg-amber-500' :
                        'bg-slate-400'
                      }`} />
                      {historyData.nurse.status}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">•</span>
                    <span className="text-xs font-semibold text-slate-500">
                      Ward: <span className="text-slate-800 font-bold">{historyData.nurse.department}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:flex md:items-center md:gap-8 border-t border-slate-100 pt-4 md:border-t-0 md:pt-0">
                  <div className="text-center md:text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Stress</p>
                    <h5 className={`text-xl font-extrabold mt-0.5 ${getFatigueRiskColor(historyData.nurse.current_fatigue)}`}>
                      {historyData.nurse.current_fatigue}%
                    </h5>
                  </div>
                  <div className="text-center md:text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Max Roster Shift</p>
                    <h5 className="text-xl font-extrabold text-slate-800 mt-0.5">
                      {historyData.nurse.max_shift_hours} Hrs
                    </h5>
                  </div>
                </div>
              </div>

              {/* KPI Summary Grid */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Shifts</span>
                    <CalendarDays size={16} className="text-sky-500" />
                  </div>
                  <h4 className="text-2xl font-black text-slate-850 mt-2">{historyData.history.length}</h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">Worked past 30 days</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Hours</span>
                    <Clock size={16} className="text-sky-500" />
                  </div>
                  <h4 className="text-2xl font-black text-slate-850 mt-2">
                    {historyData.history.reduce((acc, curr) => acc + curr.hours_worked, 0).toFixed(1)}h
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">Cumulated duty duration</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Replacements</span>
                    <ArrowRightLeft size={16} className="text-amber-500" />
                  </div>
                  <h4 className="text-2xl font-black text-slate-850 mt-2">{historyData.replacements.length}</h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">Fatigue swaps / stand-ins</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Upcoming Duties</span>
                    <Hourglass size={16} className="text-blue-500" />
                  </div>
                  <h4 className="text-2xl font-black text-slate-850 mt-2">{historyData.upcoming.length}</h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">Future roster allocations</p>
                </div>
              </div>

              {/* Tab Selector & Main Panels */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col h-[400px]">
                {/* Tabs */}
                <div className="flex border-b border-slate-150 px-4 pt-2 bg-slate-50/50 rounded-t-xl shrink-0">
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-150 ${
                      activeTab === 'history'
                        ? 'border-sky-500 text-sky-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <History size={14} /> Past Shift History ({historyData.history.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('replacements')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-150 ${
                      activeTab === 'replacements'
                        ? 'border-sky-500 text-sky-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <ArrowRightLeft size={14} /> Fatigue Replacements ({historyData.replacements.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-150 ${
                      activeTab === 'upcoming'
                        ? 'border-sky-500 text-sky-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Calendar size={14} /> Upcoming Shifts ({historyData.upcoming.length})
                  </button>
                </div>

                {/* Tab Panel Contents */}
                <div className="flex-1 overflow-y-auto p-5">
                  {/* TAB 1: Past Shifts History */}
                  {activeTab === 'history' && (
                    <div className="space-y-4">
                      {historyData.history.length > 0 ? (
                        <div className="relative overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <th className="py-2.5 px-2">Shift Period / Date</th>
                                <th className="py-2.5 px-2">Shift Type</th>
                                <th className="py-2.5 px-2">Department</th>
                                <th className="py-2.5 px-2">Duration Worked</th>
                                <th className="py-2.5 px-2 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-xs">
                              {historyData.history.map((item) => {
                                const startHour = new Date(item.start_time).getHours();
                                const shiftLabel = startHour >= 18 ? 'Night Shift' : 'Morning Shift';
                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3 px-2">
                                      <p className="font-semibold text-slate-800">{formatDate(item.start_time)}</p>
                                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                        {formatDateTime(item.start_time).split(',')[1].trim()} - {formatDateTime(item.end_time).split(',')[1].trim()}
                                      </span>
                                    </td>
                                    <td className="py-3 px-2 font-medium text-slate-600">{shiftLabel}</td>
                                    <td className="py-3 px-2 font-semibold text-slate-700">{item.department}</td>
                                    <td className="py-3 px-2 font-mono text-slate-600 font-medium">{item.hours_worked.toFixed(1)} Hrs</td>
                                    <td className="py-3 px-2 text-right">{getStatusBadge(item.status)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2 border border-dashed border-slate-200 rounded-lg">
                          <Clock size={32} className="text-slate-300" />
                          <span className="text-xs">No historical shifts found in the logs.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Fatigue Replacements */}
                  {activeTab === 'replacements' && (
                    <div className="space-y-3">
                      {historyData.replacements.length > 0 ? (
                        <div className="space-y-3">
                          {historyData.replacements.map((r) => {
                            const isReplaced = r.role === 'Replaced';
                            return (
                              <div key={r.id} className="rounded-lg border border-slate-100 bg-slate-50/40 p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border ${
                                      isReplaced
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                      {isReplaced ? 'Replaced (Fatigue Swap)' : 'Replacement Stand-In'}
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-[10px] text-slate-400 font-mono font-semibold">{formatDateTime(r.timestamp)}</span>
                                  </div>
                                  
                                  <div className="text-xs text-slate-700 font-semibold pt-1">
                                    {isReplaced ? (
                                      <span>
                                        Replaced by <span className="text-sky-600 font-extrabold">{r.replacement_nurse}</span> in the <span className="text-slate-900 font-bold">{r.department} Ward</span>.
                                      </span>
                                    ) : (
                                      <span>
                                        Replaced <span className="text-sky-600 font-extrabold">{r.original_nurse}</span> in the <span className="text-slate-900 font-bold">{r.department} Ward</span>.
                                      </span>
                                    )}
                                  </div>
                                  
                                  {r.justification && (
                                    <p className="text-[10px] text-slate-500 italic bg-white border border-slate-100 rounded p-2 mt-1">
                                      &ldquo;{r.justification}&rdquo;
                                    </p>
                                  )}
                                </div>
                                
                                <div className="shrink-0 flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                                  <span>Swap Status:</span>
                                  <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 text-[10px] uppercase font-extrabold">{r.status}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2 border border-dashed border-slate-200 rounded-lg">
                          <ArrowRightLeft size={32} className="text-slate-300" />
                          <span className="text-xs">No fatigue replacement entries recorded for this clinician.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: Upcoming Shifts */}
                  {activeTab === 'upcoming' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {historyData.upcoming.length > 0 ? (
                        historyData.upcoming.map((u) => {
                          const startHour = new Date(u.start_time).getHours();
                          const shiftLabel = startHour >= 18 ? 'Night Shift (19:00 - 07:00)' : 'Morning Shift (07:00 - 19:00)';
                          return (
                            <div key={u.id} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-sky-300 transition duration-200 shadow-xs flex items-start gap-3.5 relative">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-500 shrink-0">
                                <CalendarDays size={20} />
                              </div>
                              <div className="space-y-1">
                                <h6 className="text-xs font-bold text-slate-900 leading-none">{formatDate(u.start_time)}</h6>
                                <p className="text-[10px] font-semibold text-sky-600">{shiftLabel}</p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1 font-semibold">
                                  <span>Ward: <strong className="text-slate-600">{u.department}</strong></span>
                                  <span>•</span>
                                  <span>Duration: 12.0h</span>
                                </div>
                              </div>
                              <div className="absolute right-3 top-3">
                                {getStatusBadge(u.status)}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-2 flex flex-col items-center justify-center py-16 text-slate-400 gap-2 border border-dashed border-slate-200 rounded-lg">
                          <Calendar size={32} className="text-slate-300" />
                          <span className="text-xs">No upcoming shifts scheduled.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-40 border border-slate-200 bg-white rounded-xl shadow-sm gap-2">
              <Activity size={32} className="text-slate-300 animate-pulse" />
              <span className="text-xs font-semibold text-slate-400">Select a clinician from the list to view their detailed log.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryDashboard;
