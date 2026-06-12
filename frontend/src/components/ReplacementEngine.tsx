import React, { useEffect, useState } from 'react';
import { Nurse, ReplacementCandidate } from '../types/types';
import { 
  Users, 
  UserCheck, 
  FileText, 
  HelpCircle,
  TrendingDown,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface ReplacementEngineProps {
  selectedNurse: Nurse | null;
  onSelectNurse: (nurse: Nurse | null) => void;
  onNavigateToTab: (tab: string) => void;
}

export const ReplacementEngine: React.FC<ReplacementEngineProps> = ({ selectedNurse, onSelectNurse, onNavigateToTab }) => {
  const [fatiguedNurses, setFatiguedNurses] = useState<Nurse[]>([]);
  const [candidates, setCandidates] = useState<ReplacementCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ReplacementCandidate | null>(null);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alertShiftId, setAlertShiftId] = useState<string>('');

  const fetchFatiguedNurses = async () => {
    try {
      const res = await fetch('/api/v1/nurses');
      const data: Nurse[] = await res.json();
      // Filter active nurses with fatigue > 60 (to let users see replacements for high fatigue too, but focus on >75)
      const fatigued = data.filter(n => n.status === 'Active' && n.current_fatigue >= 60);
      setFatiguedNurses(fatigued);
      
      // If we had a selected nurse from another page, keep it, else pick the first
      if (fatigued.length > 0 && !selectedNurse) {
        onSelectNurse(fatigued[0]);
      }
    } catch (err) {
      console.error("Error fetching fatigued nurses:", err);
    }
  };

  useEffect(() => {
    fetchFatiguedNurses();
  }, []);

  // Fetch candidates whenever selected fatigued nurse changes
  useEffect(() => {
    if (!selectedNurse) {
      setCandidates([]);
      return;
    }
    
    setLoadingCandidates(true);
    // Fetch candidates list
    fetch(`/api/v1/nurses/${selectedNurse.id}/replacement-candidates`)
      .then(res => res.json())
      .then(data => {
        setCandidates(data);
        setLoadingCandidates(false);
      })
      .catch(err => {
        console.error("Error loading replacement candidates:", err);
        setLoadingCandidates(false);
      });

    // Fetch active shifts to find the Shift ID
    fetch('/api/v1/shifts/active')
      .then(res => res.json())
      .then((data: any[]) => {
        const match = data.find(s => s.nurse_code === selectedNurse.nurse_id);
        if (match) {
          setAlertShiftId(match.id);
        }
      });

  }, [selectedNurse]);

  const handleNurseSelect = (nurse: Nurse) => {
    onSelectNurse(nurse);
  };

  const handleOpenSwapModal = (candidate: ReplacementCandidate) => {
    setSelectedCandidate(candidate);
    setJustification(`Automated intervention. Relieved fatigued nurse ${selectedNurse?.name} (Fatigue: ${selectedNurse?.current_fatigue}%) with standby nurse ${candidate.name} (Fatigue: ${candidate.fatigue_score}%).`);
    setIsModalOpen(true);
  };

  const handleExecuteSwap = async () => {
    if (!selectedNurse || !selectedCandidate || !alertShiftId) return;
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/shifts/replace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_nurse_id: selectedNurse.id,
          replacement_nurse_id: selectedCandidate.id,
          shift_id: alertShiftId,
          justification: justification
        })
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        onSelectNurse(null);
        setSelectedCandidate(null);
        // Navigate to Shift Optimization to see timeline changes
        onNavigateToTab('Shift Optimization');
      } else {
        const err = await res.json();
        alert(`Failed to execute swap: ${err.detail}`);
      }
    } catch (err) {
      console.error("Error executing replacement roster:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-sky-600 bg-sky-50';
    return 'text-slate-600 bg-slate-50';
  };

  return (
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">Smart Replacement Engine</h2>
        <p className="text-sm text-slate-500">Automated candidate matching when staff fatigue levels exceed clinical thresholds.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Fatigued Staff Queue */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
            <AlertCircle size={16} className="text-rose-500" />
            Fatigued Staff Queue
          </h4>
          <div className="space-y-3">
            {fatiguedNurses.length > 0 ? (
              fatiguedNurses.map((nurse) => {
                const isSelected = selectedNurse?.id === nurse.id;
                const isCritical = nurse.current_fatigue >= 75;
                return (
                  <button
                    key={nurse.id}
                    onClick={() => handleNurseSelect(nurse)}
                    className={`w-full flex items-center justify-between rounded-lg border p-4 text-left transition ${
                      isSelected 
                        ? 'border-sky-500 bg-sky-50/50 shadow-sm' 
                        : isCritical ? 'border-rose-100 hover:bg-slate-50 bg-rose-50/10' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h5 className="font-semibold text-slate-950 text-sm">{nurse.name}</h5>
                      <span className="text-xs text-slate-500 font-medium">{nurse.department} • {nurse.skill_category}</span>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                        isCritical ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {nurse.current_fatigue}%
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">{nurse.status}</p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No active nurses currently exceed the fatigue warning index. All staff within safe parameters.
              </div>
            )}
          </div>
        </div>

        {/* Candidate Matching List */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles size={16} className="text-sky-500" />
              Roster Replacement Candidates
            </h4>
            {selectedNurse && (
              <span className="text-xs text-sky-600 bg-sky-50 font-bold px-2 py-0.5 rounded-full uppercase">
                Matching: {selectedNurse.skill_category}
              </span>
            )}
          </div>

          {selectedNurse ? (
            loadingCandidates ? (
              <div className="py-16 text-center text-sm font-semibold text-slate-500 flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
                Evaluating replacement criteria...
              </div>
            ) : candidates.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2">Rank</th>
                        <th className="px-4 py-2">Candidate</th>
                        <th className="px-4 py-2">Department</th>
                        <th className="px-4 py-2 text-center">Fatigue</th>
                        <th className="px-4 py-2 text-center">Work Hours (24h)</th>
                        <th className="px-4 py-2 text-center">Match Score</th>
                        <th className="px-4 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidates.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-3 font-bold text-slate-500">
                            #{c.recommendation_rank}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900">{c.name}</span>
                            <p className="text-[10px] font-mono text-slate-400">{c.nurse_id}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {c.department}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-xs font-bold">
                              {c.fatigue_score}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {c.current_work_hours}h
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-extrabold ${getScoreColor(c.availability_score)}`}>
                              {c.availability_score}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleOpenSwapModal(c)}
                              className="rounded bg-sky-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-sky-600 transition shadow-sm"
                            >
                              Assign Swap
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2 text-xs">
                <TrendingDown size={28} />
                No qualified candidate matches the recommendation filters (Active, same skill category, fatigue &lt; 40, work hours &lt; 10).
              </div>
            )
          ) : (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2 text-xs">
              <HelpCircle size={28} />
              Please select a fatigued nurse from the queue to run the recommendation calculations.
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {isModalOpen && selectedCandidate && selectedNurse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-950 flex items-center gap-1.5">
              <UserCheck size={20} className="text-sky-500" />
              Confirm Shift Replacement Swap
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              This action modifies the roster in real time. Please review the details before committing.
            </p>

            {/* Swap comparison */}
            <div className="my-5 rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Fatigued Nurse:</span>
                <span className="font-bold text-rose-600">{selectedNurse.name} ({selectedNurse.current_fatigue}%)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Replacement Nurse:</span>
                <span className="font-bold text-emerald-600">{selectedCandidate.name} ({selectedCandidate.fatigue_score}%)</span>
              </div>
              <div className="flex justify-between text-xs border-t border-slate-200 pt-2">
                <span className="text-slate-500">Department:</span>
                <span className="font-semibold text-slate-800">{selectedNurse.department}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Qualification:</span>
                <span className="font-semibold text-slate-800">{selectedNurse.skill_category}</span>
              </div>
            </div>

            {/* Justification input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                <FileText size={12} /> Justification SOP Log:
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteSwap}
                disabled={submitting}
                className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-600 transition shadow-sm flex items-center gap-1.5"
              >
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : 'Confirm Swap'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ReplacementEngine;
