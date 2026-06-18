import React, { useEffect, useState } from 'react';
import { Nurse } from '../types/types';
import { 
  CalendarRange, 
  UserPlus, 
  Building, 
  Clock, 
  CheckCircle2, 
  ListChecks, 
  AlertTriangle,
  RotateCw
} from 'lucide-react';

interface DutyAllotmentProps {
  // Add props if needed in future
}

export const DutyAllotment: React.FC<DutyAllotmentProps> = () => {
  const [allNurses, setAllNurses] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [selectedDept, setSelectedDept] = useState('ICU');
  const [selectedShiftType, setSelectedShiftType] = useState('Morning');
  const [durationHours, setDurationHours] = useState(12.0);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const DEPARTMENTS = ["ICU", "Emergency", "Cardiology", "General Ward"];

  const fetchNurses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/nurses');
      const data: Nurse[] = await res.json();
      setAllNurses(data);
    } catch (err) {
      console.error("Error loading nurses list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNurses();
  }, []);

  const handleAllotDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!selectedNurseId) {
      setErrorMsg('Please select a nurse from the standby list.');
      return;
    }
    if (durationHours <= 0 || durationHours > 24) {
      setErrorMsg('Shift duration must be between 1 and 24 hours.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/shifts/allot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nurse_id: selectedNurseId,
          department: selectedDept,
          shift_type: selectedShiftType,
          duration_hours: durationHours
        })
      });

      if (res.ok) {
        setSuccessMsg('Duty successfully allotted and logged!');
        setSelectedNurseId('');
        // Refresh nurses lists
        await fetchNurses();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || 'Allocation failed.');
      }
    } catch (err) {
      console.error("Error during allotment submission:", err);
      setErrorMsg('Could not connect to API server.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter nurses into categories
  const activeNurses = allNurses.filter(n => n.status !== 'Offline');
  const standbyNurses = allNurses.filter(n => n.status === 'Offline');

  // Group active nurses by department
  const nursesByDept = (dept: string) => activeNurses.filter(n => n.department === dept);

  const getFatigueColor = (fatigue: number) => {
    if (fatigue >= 75) return 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50';
    if (fatigue >= 50) return 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50';
    return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Active') return 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/50';
    if (status === 'Break') return 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 border-amber-100 dark:border-amber-900/50';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  };

  return (
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6 bg-slate-50 dark:bg-slate-950 text-slate-850 dark:text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Workforce & Duty Allotment</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Allot standby clinicians to active clinical departments and configure shift durations.</p>
        </div>
        <button 
          onClick={fetchNurses} 
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-350 hover:bg-slate-55 dark:hover:bg-slate-850 transition"
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Lists
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Allotment Form (Left Panel) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm text-left">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
              <UserPlus size={16} className="text-purple-500" />
              Duty Allotment
            </h4>

            {errorMsg && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 p-3 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-start gap-1.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-start gap-1.5">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                {successMsg}
              </div>
            )}

            <form onSubmit={handleAllotDuty} className="space-y-4">
              {/* Standby Nurse Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Select Standby Nurse</label>
                <select
                  value={selectedNurseId}
                  onChange={(e) => setSelectedNurseId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 transition"
                >
                  <option value="">-- Choose Standby Nurse --</option>
                  {standbyNurses.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.skill_category} • Fatigue: {n.current_fatigue}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Assign Ward / Dept</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 transition"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Shift Type Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Select Shift Rotation</label>
                <select
                  value={selectedShiftType}
                  onChange={(e) => setSelectedShiftType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 transition"
                >
                  <option value="Morning">Morning Shift (07:00 - 19:00)</option>
                  <option value="Night">Night Shift (19:00 - 07:00)</option>
                </select>
              </div>

              {/* Shift Duration Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Shift Duration (Hours)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="24"
                    value={durationHours}
                    onChange={(e) => setDurationHours(parseFloat(e.target.value) || 12.0)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 pr-12 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 transition"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">HRS</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 py-2.5 text-xs font-black text-white shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5 uppercase"
              >
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <CalendarRange size={14} />
                    Allot Roster Duty
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Standby pool summary list */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm max-h-[300px] overflow-y-auto text-left">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ListChecks size={14} />
              Standby Pool ({standbyNurses.length})
            </h4>
            <div className="space-y-2">
              {standbyNurses.map((n) => (
                <div key={n.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200 leading-none">{n.name}</p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5 block">{n.skill_category}</span>
                  </div>
                  <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                    Fatigue: {n.current_fatigue}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ward Allotments Grid (Right Panels) */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm h-full text-left">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="flex items-center gap-1.5">
                <Building size={16} className="text-purple-500" />
                Active Ward Allotment Status
              </span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Total Active: {activeNurses.length}</span>
            </h4>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 h-[calc(100%-3rem)]">
              {DEPARTMENTS.map((dept) => {
                const nursesInDept = nursesByDept(dept);
                return (
                  <div key={dept} className="rounded-lg border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 p-4 flex flex-col h-[520px]">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{dept} Ward</span>
                      <span className="rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-350 px-2 py-0.5 text-[10px] font-black">
                        {nursesInDept.length}
                      </span>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                      {nursesInDept.length > 0 ? (
                        nursesInDept.map((nurse) => {
                          return (
                            <div 
                              key={nurse.id} 
                              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs hover:shadow-sm transition space-y-2 relative"
                            >
                              <div className="flex justify-between items-start gap-1">
                                <div className="text-left">
                                  <h6 className="font-bold text-slate-800 dark:text-slate-200 text-xs leading-tight">{nurse.name}</h6>
                                  <p className="text-[9px] font-mono text-slate-400 mt-0.5">{nurse.nurse_id}</p>
                                </div>
                                <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-extrabold border ${getFatigueColor(nurse.current_fatigue)}`}>
                                  F: {nurse.current_fatigue}%
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                                <span className="font-bold text-slate-400">{nurse.skill_category}</span>
                                <span className={`px-1.5 py-0.5 rounded font-extrabold uppercase border ${getStatusBadge(nurse.status)}`}>
                                  {nurse.status}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-600 text-center px-4">
                          No active nurses allotted to this ward.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DutyAllotment;
