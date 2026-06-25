import React, { useEffect, useState } from 'react';
import { Nurse } from '../types/types';
import { 
  CalendarRange, 
  UserPlus, 
  Building, 
  CheckCircle2, 
  ListChecks, 
  AlertTriangle,
  RotateCw,
  Sparkles,
  Clock,
  Trash2,
  Check
} from 'lucide-react';

interface DutyAllotmentProps {
  // Add props if needed in future
}

interface ProposedAllotment {
  nurse_id: string;
  nurse_name: string;
  nurse_code: string;
  department: string;
  shift_type: string;
  duration_hours: number;
  start_time: string;
  end_time: string;
  past_hours_worked: number;
  average_past_fatigue: number;
  hours_rest_obtained: number;
  score: number;
  shift_classification?: string;
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

  // Auto-Roster State
  const [proposedFixture, setProposedFixture] = useState<ProposedAllotment[] | null>(null);
  const [generatingRoster, setGeneratingRoster] = useState(false);
  const [rosterError, setRosterError] = useState('');
  const [rosterSuccess, setRosterSuccess] = useState('');

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

  const handleGenerateRoster = async () => {
    setGeneratingRoster(true);
    setRosterError('');
    setRosterSuccess('');
    try {
      const res = await fetch('/api/v1/shifts/auto-fixture');
      if (res.ok) {
        const data = await res.json();
        setProposedFixture(data);
        if (data.length === 0) {
          setRosterError('No eligible standby nurses available to satisfy schedule constraints for tomorrow.');
        }
      } else {
        const err = await res.json();
        setRosterError(err.detail || 'Failed to generate proposal.');
      }
    } catch (err) {
      console.error("Error generating roster:", err);
      setRosterError('Could not connect to API server.');
    } finally {
      setGeneratingRoster(false);
    }
  };

  const handleConfirmRoster = async () => {
    if (!proposedFixture) return;
    setGeneratingRoster(true);
    setRosterError('');
    setRosterSuccess('');
    try {
      const res = await fetch('/api/v1/shifts/confirm-fixture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allotments: proposedFixture
        })
      });
      if (res.ok) {
        setRosterSuccess("Tomorrow's cyclic roster successfully confirmed and scheduled!");
        setProposedFixture(null);
        await fetchNurses(); // Refresh lists
        setTimeout(() => setRosterSuccess(''), 5000);
      } else {
        const err = await res.json();
        setRosterError(err.detail || 'Failed to confirm roster.');
      }
    } catch (err) {
      console.error("Error confirming roster:", err);
      setRosterError('Could not connect to API server.');
    } finally {
      setGeneratingRoster(false);
    }
  };

  const handleRejectRoster = () => {
    setProposedFixture(null);
    setRosterError('');
    setRosterSuccess('Proposed roster rejected and cleared.');
    setTimeout(() => setRosterSuccess(''), 4000);
  };

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
  const activeNurses = allNurses.filter(n => n.status === 'Active' || n.status === 'Break');
  const standbyNurses = allNurses.filter(n => n.status === 'Offline');

  // Group active nurses by department
  const nursesByDept = (dept: string) => activeNurses.filter(n => n.department === dept);

  const getFatigueColor = (fatigue: number) => {
    if (fatigue >= 75) return 'bg-pink-50 text-pink-700 border-pink-200';
    if (fatigue >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Active') return 'bg-violet-50 text-violet-700 border-violet-100';
    if (status === 'Break') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (status === 'Leave') return 'bg-rose-50 text-rose-700 border-rose-100';
    return 'bg-slate-100 text-slate-650 border-slate-200';
  };

  return (
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6 bg-transparent text-slate-850">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/20 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Workforce & Duty Allotment</h2>
          <p className="text-xs text-slate-500">Allot standby clinicians to active clinical departments and configure shift durations.</p>
        </div>
        <button 
          onClick={fetchNurses} 
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/45 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-white/65 transition"
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Lists
        </button>
      </div>

      {/* Next-Day Auto-Roster Section */}
      <div className="space-y-4">
        {/* Banner/Control Card */}
        {!proposedFixture ? (
          <div className="rounded-xl border border-white/60 glass-card p-5 shadow-sm text-left flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-violet-50/20 to-indigo-50/20">
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Sparkles size={18} className="text-violet-500 animate-pulse" />
                Automatic Next-Day Roster Generator
              </h3>
              <p className="text-xs text-slate-500 max-w-2xl">
                Automatically generate tomorrow's cyclic roster allotments across all departments. The algorithm selects standby nurses by prioritizing minimum past hours worked, low average fatigue history, and a minimum of 12 hours of rest between shifts.
              </p>
            </div>
            <button
              onClick={handleGenerateRoster}
              disabled={generatingRoster || loading}
              className="w-full md:w-auto shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-650 px-5 py-2.5 text-xs font-black text-white shadow-sm transition disabled:opacity-50 uppercase"
            >
              {generatingRoster ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Calculating Optimal Fixtures...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Generate Tomorrow's Auto-Roster
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-violet-200/60 glass-card p-5 shadow-md text-left bg-gradient-to-b from-white/60 to-white/40 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/30 pb-3 mb-4 gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-violet-500" />
                  Proposed Next-Day Cyclic Roster (Tomorrow)
                </h3>
                <p className="text-xs text-slate-500">
                  Review the automatically calculated, fatigue-optimized cyclic roster before publishing to the schedule.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={handleRejectRoster}
                  disabled={generatingRoster}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50/50 hover:bg-rose-50/80 px-4 py-2 text-xs font-bold text-rose-700 transition"
                >
                  <Trash2 size={14} />
                  Reject Proposal
                </button>
                <button
                  onClick={handleConfirmRoster}
                  disabled={generatingRoster}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 px-4 py-2 text-xs font-black text-white shadow-sm transition uppercase"
                >
                  {generatingRoster ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <Check size={14} />
                  )}
                  Confirm & Schedule
                </button>
              </div>
            </div>

            {/* proposed cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {proposedFixture.map((allot, index) => {
                // Formatting timestamps to readable time
                const startTime = new Date(allot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const endTime = new Date(allot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div key={index} className="rounded-lg border border-white/50 bg-white/55 p-3.5 shadow-sm space-y-3 relative hover:border-violet-300 transition">
                    {/* Header: Dept & Shift Type */}
                    <div className="flex justify-between items-start border-b border-slate-100 pb-1.5 gap-1">
                      <div className="flex flex-col text-left">
                        <span className="font-extrabold text-xs text-slate-800 leading-tight">{allot.department}</span>
                        {allot.shift_classification && (
                          <span className={`text-[8px] font-black uppercase mt-1 px-1.5 py-0.5 rounded w-max ${
                            allot.shift_classification === 'Double Shift'
                              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white'
                              : 'bg-slate-100 text-slate-550 border border-slate-200'
                          }`}>
                            {allot.shift_classification}
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase shrink-0 ${
                        allot.shift_type.includes('Morning') && !allot.shift_type.includes('+')
                          ? 'bg-sky-50 text-sky-700 border border-sky-100' 
                          : allot.shift_type.includes('Afternoon') && !allot.shift_type.includes('+')
                          ? 'bg-amber-50 text-amber-700 border border-amber-150'
                          : allot.shift_type.includes('Night') && !allot.shift_type.includes('+')
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          : 'bg-purple-50 text-purple-700 border border-purple-150'
                      }`}>
                        {allot.shift_type}
                      </span>
                    </div>

                    {/* Nurse Info */}
                    <div>
                      <h4 className="font-black text-slate-800 text-xs">{allot.nurse_name}</h4>
                      <p className="text-[9px] font-mono text-slate-400 mt-0.5">{allot.nurse_code}</p>
                    </div>

                    {/* Shift Time */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-550 bg-slate-50/50 p-1.5 rounded border border-slate-100">
                      <Clock size={11} className="text-slate-400 shrink-0" />
                      <span>{startTime} - {endTime} ({allot.duration_hours.toFixed(1)}h)</span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Rest Obtained</span>
                        <span className="text-[10px] font-black text-indigo-600">{allot.hours_rest_obtained} hrs</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Avg Fatigue</span>
                        <span className="text-[10px] font-black text-slate-700">{allot.average_past_fatigue}%</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Past Work</span>
                        <span className="text-[10px] font-black text-slate-700">{allot.past_hours_worked} hrs</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Score</span>
                        <span className={`text-[10px] font-black ${
                          allot.score < 20 ? 'text-emerald-600' : allot.score < 40 ? 'text-amber-600' : 'text-rose-600'
                        }`}>{allot.score}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Global Feedback Messages for Auto-Roster */}
        {rosterError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-start gap-1.5 shadow-sm text-left">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {rosterError}
          </div>
        )}
        {rosterSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 flex items-start gap-1.5 shadow-sm text-left animate-fade-in">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            {rosterSuccess}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Allotment Form (Left Panel) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-white/60 glass-card p-5 shadow-sm text-left">
            <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5 border-b border-white/20 pb-2">
              <UserPlus size={16} className="text-violet-500" />
              Duty Allotment
            </h4>

            {errorMsg && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-start gap-1.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 flex items-start gap-1.5">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                {successMsg}
              </div>
            )}

            <form onSubmit={handleAllotDuty} className="space-y-4">
              {/* Standby Nurse Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Select Standby Nurse</label>
                <select
                  value={selectedNurseId}
                  onChange={(e) => setSelectedNurseId(e.target.value)}
                  className="w-full rounded-lg border border-white/60 bg-white/45 p-2.5 text-xs text-slate-700 focus:outline-none focus:border-violet-500 focus:bg-white/70 transition"
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
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Assign Ward / Dept</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full rounded-lg border border-white/60 bg-white/45 p-2.5 text-xs text-slate-700 focus:outline-none focus:border-violet-500 focus:bg-white/70 transition"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Shift Type Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Select Shift Rotation</label>
                <select
                  value={selectedShiftType}
                  onChange={(e) => setSelectedShiftType(e.target.value)}
                  className="w-full rounded-lg border border-white/60 bg-white/45 p-2.5 text-xs text-slate-700 focus:outline-none focus:border-violet-500 focus:bg-white/70 transition"
                >
                  <option value="Morning">Morning Shift (07:00 - 19:00)</option>
                  <option value="Night">Night Shift (19:00 - 07:00)</option>
                </select>
              </div>

              {/* Shift Duration Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Shift Duration (Hours)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="24"
                    value={durationHours}
                    onChange={(e) => setDurationHours(parseFloat(e.target.value) || 12.0)}
                    className="w-full rounded-lg border border-white/60 bg-white/45 p-2.5 pr-12 text-xs text-slate-700 focus:outline-none focus:border-violet-500 focus:bg-white/70 transition"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-[10px] font-bold text-slate-400">HRS</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-650 py-2.5 text-xs font-black text-white shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5 uppercase"
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
          <div className="rounded-xl border border-white/60 glass-card p-5 shadow-sm max-h-[300px] overflow-y-auto text-left">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ListChecks size={14} />
              Standby Pool ({standbyNurses.length})
            </h4>
            <div className="space-y-2">
              {standbyNurses.map((n) => (
                <div key={n.id} className="flex items-center justify-between border-b border-white/10 pb-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-800 leading-none">{n.name}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{n.skill_category}</span>
                  </div>
                  <span className="text-[10px] font-bold bg-white/20 border border-white/30 text-slate-655 px-2 py-0.5 rounded">
                    Fatigue: {n.current_fatigue}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ward Allotments Grid (Right Panels) */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-white/60 glass-card p-5 shadow-sm h-full text-left">
            <h4 className="text-sm font-bold text-slate-800 mb-5 flex items-center justify-between border-b border-white/20 pb-3">
              <span className="flex items-center gap-1.5">
                <Building size={16} className="text-sky-500" />
                Active Ward Allotment Status
              </span>
              <span className="text-xs font-bold text-slate-400">Total Active: {activeNurses.length}</span>
            </h4>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 h-[calc(100%-3rem)]">
              {DEPARTMENTS.map((dept) => {
                const nursesInDept = nursesByDept(dept);
                return (
                  <div key={dept} className="rounded-lg border border-white/40 bg-white/20 p-4 flex flex-col h-[520px]">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                      <span className="font-bold text-slate-800 text-xs">{dept} Ward</span>
                      <span className="rounded-full bg-white/55 text-slate-700 px-2 py-0.5 text-[10px] font-black border border-white/30">
                        {nursesInDept.length}
                      </span>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                      {nursesInDept.length > 0 ? (
                        nursesInDept.map((nurse) => {
                          return (
                            <div 
                              key={nurse.id} 
                              className="rounded-lg border border-white/50 bg-white/45 p-3 shadow-xs hover:bg-white/65 hover:shadow-sm transition space-y-2 relative"
                            >
                              <div className="flex justify-between items-start gap-1">
                                <div className="text-left">
                                  <h6 className="font-bold text-slate-800 text-xs leading-tight">{nurse.name}</h6>
                                  <p className="text-[9px] font-mono text-slate-400 mt-0.5">{nurse.nurse_id}</p>
                                </div>
                                <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-extrabold border ${getFatigueColor(nurse.current_fatigue)}`}>
                                  F: {nurse.current_fatigue}%
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-white/10">
                                <span className="font-bold text-slate-400">{nurse.skill_category}</span>
                                <span className={`px-1.5 py-0.5 rounded font-extrabold uppercase border ${getStatusBadge(nurse.status)}`}>
                                  {nurse.status}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-white/60 bg-white/10 text-[10px] text-slate-500 text-center px-4">
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
