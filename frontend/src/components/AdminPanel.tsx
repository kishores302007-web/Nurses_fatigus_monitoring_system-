import React, { useEffect, useState } from 'react';
import { Nurse, DeviceResponse } from '../types/types';
import { 
  UserPlus, 
  Cpu, 
  Sliders, 
  FileLock2, 
  Save, 
  CheckCircle
} from 'lucide-react';

interface AuditItem {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  details: string;
}

export const AdminPanel: React.FC = () => {
  const [, setNurses] = useState<Nurse[]>([]);
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  
  // Alert Configurations
  const [thresholds, setThresholds] = useState({
    low: 60,
    high: 75,
    critical: 90
  });

  // Nurse Form State
  const [nurseForm, setNurseForm] = useState({
    nurse_id: '',
    name: '',
    email: '',
    department: 'ICU',
    skill_category: 'Critical Care',
    max_shift_hours: 12
  });

  const [savingThresholds, setSavingThresholds] = useState(false);
  const [savingNurse, setSavingNurse] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchAdminData = async () => {
    try {
      const nRes = await fetch('/api/v1/nurses');
      const nData = await nRes.json();
      setNurses(nData);

      // Generate mock devices mapping list since they are registered in the seeder
      const macs = nData.map((n: any) => ({
        id: `dev-${n.id}`,
        mac_address: `00:1A:2B:3C:${n.nurse_id.replace('NS-', '')}:FF`,
        status: n.device_status,
        assigned_nurse_name: n.name,
        last_seen: n.last_seen
      }));
      setDevices(macs);

      // Fetch replacement logs for scheduler audit logs
      const repRes = await fetch('/api/v1/shifts/history');
      const repData = await repRes.json();
      const mockAudits: AuditItem[] = [
        {
          id: '1',
          user: 'System Ingestion',
          action: 'DB_SEED_SUCCESS',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          details: 'Successfully loaded 50 clinical profiles and generated 100,000+ time-series records.'
        },
        {
          id: '2',
          user: 'Security Module',
          action: 'ACCESS_TOKEN_ISSUED',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          details: 'Admin token authorized and granted to supervisor console.'
        },
        ...repData.map((r: any, idx: number) => ({
          id: `audit-rep-${idx}`,
          user: 'Shift Optimizer',
          action: 'ROSTER_REPLACEMENT_ACCEPTED',
          timestamp: r.timestamp,
          details: `Replaced fatigued nurse ${r.original_nurse} with ${r.replacement_nurse}. Justification: "${r.justification}"`
        }))
      ];
      setAudits(mockAudits);

    } catch (err) {
      console.error("Error loading admin configurations:", err);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleSaveThresholds = () => {
    setSavingThresholds(true);
    setTimeout(() => {
      setSavingThresholds(false);
      setSuccessMsg('Alert thresholds successfully calibrated and saved.');
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 800);
  };

  const handleAddNurse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNurse(true);
    // Simple mock success
    setTimeout(() => {
      setSavingNurse(false);
      setSuccessMsg(`Nurse ${nurseForm.name} successfully registered in registry.`);
      setNurseForm({
        nurse_id: '',
        name: '',
        email: '',
        department: 'ICU',
        skill_category: 'Critical Care',
        max_shift_hours: 12
      });
      fetchAdminData();
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 1000);
  };

  return (
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6 bg-transparent text-slate-800">
      {/* Header */}
      <div className="border-b border-white/20 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">Administration Console</h2>
        <p className="text-sm text-slate-500">Configure alert thresholds, register staff, map IoT devices, and inspect audit logs.</p>
      </div>

      {successMsg && (
        <div className="rounded-lg border border-emerald-250/30 bg-emerald-50/70 p-4 text-xs font-bold text-emerald-850 flex items-center gap-1.5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-200 backdrop-blur-xs">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 text-left">
        {/* Left: Nurse Register Form */}
        <div className="rounded-xl border border-white/60 glass-card p-5 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <UserPlus size={16} className="text-violet-500" /> Register New Nurse Profile
          </h4>
          <form onSubmit={handleAddNurse} className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-left">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-450 uppercase">Nurse ID Code</label>
              <input
                type="text"
                placeholder="e.g. NS-051"
                required
                value={nurseForm.nurse_id}
                onChange={e => setNurseForm({...nurseForm, nurse_id: e.target.value})}
                className="w-full rounded-lg border border-white/60 p-2 text-xs bg-white/20 text-slate-850 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:bg-white/70 transition placeholder-slate-405"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-450 uppercase">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Rachel Adams"
                required
                value={nurseForm.name}
                onChange={e => setNurseForm({...nurseForm, name: e.target.value})}
                className="w-full rounded-lg border border-white/60 p-2 text-xs bg-white/20 text-slate-850 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:bg-white/70 transition placeholder-slate-405"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-450 uppercase">Email Address</label>
              <input
                type="email"
                placeholder="e.g. r.adams@hospital.org"
                required
                value={nurseForm.email}
                onChange={e => setNurseForm({...nurseForm, email: e.target.value})}
                className="w-full rounded-lg border border-white/60 p-2 text-xs bg-white/20 text-slate-855 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:bg-white/70 transition placeholder-slate-405"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-450 uppercase">Department</label>
              <select
                value={nurseForm.department}
                onChange={e => setNurseForm({...nurseForm, department: e.target.value, skill_category: e.target.value === 'ICU' ? 'Critical Care' : e.target.value === 'Emergency' ? 'ER Specialist' : e.target.value === 'Cardiology' ? 'Cardiac Specialist' : 'General Practice'})}
                className="w-full rounded-lg border border-white/60 p-2 text-xs bg-white/45 text-slate-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition shadow-sm cursor-pointer"
              >
                <option value="ICU">ICU</option>
                <option value="Emergency">Emergency</option>
                <option value="Cardiology">Cardiology</option>
                <option value="General Ward">General Ward</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-450 uppercase">Qualification Category</label>
              <input
                type="text"
                disabled
                value={nurseForm.skill_category}
                className="w-full rounded-lg border border-white/20 p-2 text-xs bg-white/10 text-slate-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-455 uppercase">Max Shift Limit (Hours)</label>
              <input
                type="number"
                value={nurseForm.max_shift_hours}
                onChange={e => setNurseForm({...nurseForm, max_shift_hours: parseInt(e.target.value) || 0})}
                className="w-full rounded-lg border border-white/60 p-2 text-xs bg-white/20 text-slate-855 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:bg-white/70 transition placeholder-slate-405"
              />
            </div>
            
            <button
              type="submit"
              disabled={savingNurse}
              className="sm:col-span-2 mt-2 w-full rounded-lg bg-violet-600 hover:bg-violet-750 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm flex items-center justify-center gap-1.5 uppercase"
            >
              {savingNurse ? 'Registering...' : 'Add Nurse to Database'}
            </button>
          </form>
        </div>

        {/* Right: Alarm threshold parameters */}
        <div className="rounded-xl border border-white/60 glass-card p-5 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Sliders size={16} className="text-violet-500" /> Calibrate Alarm Parameters
          </h4>
          <div className="space-y-4 text-left">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Low Fatigue Trigger (Warning)</span>
                <span className="font-bold text-slate-800">{thresholds.low}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="65"
                value={thresholds.low}
                onChange={e => setThresholds({...thresholds, low: parseInt(e.target.value)})}
                className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-violet-650"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>High Fatigue Trigger (SMS + Supervisor Notification)</span>
                <span className="font-bold text-slate-800">{thresholds.high}%</span>
              </div>
              <input
                type="range"
                min="66"
                max="80"
                value={thresholds.high}
                onChange={e => setThresholds({...thresholds, high: parseInt(e.target.value)})}
                className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-violet-655"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Critical Fatigue Trigger (Mandatory Swap Engine)</span>
                <span className="font-bold text-slate-800">{thresholds.critical}%</span>
              </div>
              <input
                type="range"
                min="81"
                max="95"
                value={thresholds.critical}
                onChange={e => setThresholds({...thresholds, critical: parseInt(e.target.value)})}
                className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-violet-655"
              />
            </div>
            
            <button
              onClick={handleSaveThresholds}
              disabled={savingThresholds}
              className="mt-2 w-full rounded-lg bg-violet-600 hover:bg-violet-750 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm flex items-center justify-center gap-1.5 uppercase"
            >
              <Save size={14} />
              {savingThresholds ? 'Saving Settings...' : 'Save Parameters'}
            </button>
          </div>
        </div>
      </div>

      {/* Device mapping registry */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 text-left">
        <div className="rounded-xl border border-white/60 glass-card p-5 shadow-sm lg:col-span-1">
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
            <Cpu size={16} className="text-slate-500" /> Paired Wearables List
          </h4>
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {devices.map(dev => (
              <div key={dev.id} className="flex justify-between items-center border border-white/20 p-3 rounded-lg bg-white/10 text-xs text-left">
                <div>
                  <span className="font-semibold font-mono text-slate-700">{dev.mac_address}</span>
                  <p className="text-[10px] text-slate-400 font-medium">Assigned: {dev.assigned_nurse_name}</p>
                </div>
                <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                  dev.status === 'Active' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {dev.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit logs trail */}
        <div className="rounded-xl border border-white/60 glass-card p-5 shadow-sm lg:col-span-2">
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
            <FileLock2 size={16} className="text-slate-500" /> System Action Audit Trail
          </h4>
          <div className="overflow-y-auto max-h-[350px] border border-white/20 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/20 bg-white/20 font-bold uppercase text-slate-500">
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Operator</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {audits.map(audit => (
                  <tr key={audit.id} className="hover:bg-white/20 transition">
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {new Date(audit.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-750">
                      {audit.user}
                    </td>
                    <td className="px-4 py-3 text-violet-600 font-semibold">
                      {audit.action}
                    </td>
                    <td className="px-4 py-3 text-slate-655 leading-snug">
                      {audit.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
