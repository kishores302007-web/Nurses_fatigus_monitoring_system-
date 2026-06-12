import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { Nurse } from '../types/types';
import { 
  Users, 
  Activity, 
  UserPlus, 
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardProps {
  onSelectNurseForReplacement: (nurse: Nurse) => void;
  onNavigateToTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectNurseForReplacement, onNavigateToTab }) => {
  const { liveUpdates } = useWebSocket();
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [kpis, setKpis] = useState({
    total_nurses: 0,
    active_nurses: 0,
    high_fatigue_nurses: 0,
    available_replacements: 0,
    shift_coverage_pct: 0.0
  });
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  const fetchDashboardData = async () => {
    try {
      const [nRes, kRes, cRes] = await Promise.all([
        fetch('/api/v1/nurses'),
        fetch('/api/v1/nurses/kpis'),
        fetch('/api/v1/nurses/charts')
      ]);
      const nData = await nRes.json();
      const kData = await kRes.json();
      const cData = await cRes.json();

      setNurses(nData);
      setKpis(kData);
      setChartData(cData);
    } catch (err) {
      console.error("Error fetching dashboard statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Sync WebSocket live telemetry updates into our local nurses state
  useEffect(() => {
    if (Object.keys(liveUpdates).length === 0) return;

    setNurses((prevNurses) => {
      let updated = false;
      const newNurses = prevNurses.map((nurse) => {
        const update = liveUpdates[nurse.id];
        if (update) {
          updated = true;
          return {
            ...nurse,
            current_fatigue: update.fatigue_score,
            status: update.risk_level === 'Critical' && nurse.status === 'Active' ? 'Active' : nurse.status, // maintain status
            work_hours: update.shift_hours,
            device_status: update.is_anomaly ? 'Disconnected' : 'Active' as any,
            last_seen: new Date().toISOString()
          };
        }
        return nurse;
      });

      // Re-calculate KPIs on live updates to reflect changes immediately
      if (updated) {
        const total = newNurses.length;
        const activeCount = newNurses.filter(n => ['Active', 'Break'].includes(n.status)).length;
        const fatigueCount = newNurses.filter(n => ['Active', 'Break'].includes(n.status) && n.current_fatigue >= 75).length;
        const replacementsCount = newNurses.filter(n => ['Active', 'Break'].includes(n.status) && n.current_fatigue < 40).length;
        
        setKpis({
          total_nurses: total,
          active_nurses: activeCount,
          high_fatigue_nurses: fatigueCount,
          available_replacements: replacementsCount,
          shift_coverage_pct: total > 0 ? parseFloat(((activeCount / total) * 100).toFixed(1)) : 0
        });
      }

      return newNurses;
    });
  }, [liveUpdates]);

  const filteredNurses = nurses.filter((n) => {
    const matchesSearch = n.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          n.nurse_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'All' || n.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const getFatigueBadgeClass = (score: number) => {
    if (score <= 30) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (score <= 60) return 'bg-amber-50 text-amber-700 border-amber-100';
    if (score <= 80) return 'bg-orange-50 text-orange-700 border-orange-100';
    return 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse';
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === 'Active') return 'bg-sky-50 text-sky-700 border-sky-100';
    if (status === 'Break') return 'bg-yellow-50 text-yellow-700 border-yellow-100';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  // Recharts color palette
  const COLORS = ['#0ea5e9', '#0d9488', '#94a3b8'];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-500">Loading Clinical Registries...</p>
        </div>
      </div>
    );
  }

  // Pre-process Bar Chart data
  const barChartData = chartData ? Object.keys(chartData.dept_presence).map(dept => ({
    name: dept,
    Active: chartData.dept_presence[dept].active,
    Standby: chartData.dept_presence[dept].total - chartData.dept_presence[dept].active,
  })) : [];

  return (
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Ward Attendance & Live Registry</h2>
          <p className="text-sm text-slate-500">Real-time status of hospital workforce based on wearable IoT telemetry.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw size={16} />
          Sync Data
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Staff Registry</span>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Users size={20} /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{kpis.total_nurses}</h3>
            <p className="text-xs text-slate-400 mt-1">Total registered nurses</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Active On-Site</span>
            <div className="rounded-lg bg-sky-50 p-2 text-sky-600"><CheckCircle size={20} /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-950">{kpis.active_nurses}</h3>
            <p className="text-xs text-sky-600 mt-1">Nurses active / on break</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-l-rose-500 border-l-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">High Fatigue (&gt;75)</span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600"><AlertTriangle size={20} /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-rose-600">{kpis.high_fatigue_nurses}</h3>
            <p className="text-xs text-rose-500 mt-1">Immediate relief required</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Available Swaps</span>
            <div className="rounded-lg bg-teal-50 p-2 text-teal-600"><UserPlus size={20} /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{kpis.available_replacements}</h3>
            <p className="text-xs text-teal-600 mt-1">Nurses with fatigue &lt; 40</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Shift Coverage</span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Activity size={20} /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{kpis.shift_coverage_pct}%</h3>
            <p className="text-xs text-slate-400 mt-1">Current staff capacity</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {chartData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Department presence bar chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h4 className="text-sm font-bold text-slate-900 mb-4">Department-wise Staff Presence</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="Active" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Standby" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Shift Distribution Pie Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-4">Roster Allocation</h4>
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.shift_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.shift_distribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-col gap-2 justify-center">
              {chartData.shift_distribution.map((entry: any, index: number) => (
                <div key={entry.name} className="flex items-center justify-between text-xs px-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="text-slate-600">{entry.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900">{entry.value} Nurses</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Roster & Search Filters */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-sm font-bold text-slate-900">Nurse Registry & Live Biosignals</h4>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex items-center rounded-lg border border-slate-200 px-3 py-1.5 bg-slate-50 text-slate-500 focus-within:border-sky-500 focus-within:bg-white transition">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent pl-2 text-sm text-slate-800 focus:outline-none w-48"
              />
            </div>
            {/* Department Dropdown */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white text-slate-700 shadow-sm focus:outline-none focus:border-sky-500"
            >
              <option value="All">All Departments</option>
              <option value="ICU">ICU</option>
              <option value="Emergency">Emergency</option>
              <option value="Cardiology">Cardiology</option>
              <option value="General Ward">General Ward</option>
            </select>
          </div>
        </div>

        {/* Nurse Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3.5">Nurse ID</th>
                <th className="px-6 py-3.5">Nurse Name</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Shift Duration</th>
                <th className="px-6 py-3.5">Current Status</th>
                <th className="px-6 py-3.5">Device MAC</th>
                <th className="px-6 py-3.5">Last Seen</th>
                <th className="px-6 py-3.5 text-center">Fatigue Index</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredNurses.length > 0 ? (
                filteredNurses.map((nurse) => {
                  const isHighFatigue = nurse.current_fatigue >= 75;
                  return (
                    <tr key={nurse.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-600">
                        {nurse.nurse_id}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {nurse.name}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {nurse.department}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {nurse.status === 'Offline' ? '0.0h' : `${nurse.work_hours}h`}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(nurse.status)}`}>
                          {nurse.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                        {nurse.device_status === 'Active' ? (
                          <span className="flex items-center gap-1.5 text-emerald-600">
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Connected
                          </span>
                        ) : nurse.device_status === 'Disconnected' ? (
                          <span className="flex items-center gap-1.5 text-rose-500 animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-rose-500"></span> Lost Signal
                          </span>
                        ) : (
                          <span className="text-slate-400">Offline</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(nurse.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold ${getFatigueBadgeClass(nurse.current_fatigue)}`}>
                          {nurse.current_fatigue}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isHighFatigue && nurse.status === 'Active' ? (
                          <button
                            onClick={() => onSelectNurseForReplacement(nurse)}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-600 transition shadow-sm"
                          >
                            Swap Staff
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              onSelectNurseForReplacement(nurse);
                              onNavigateToTab('Fatigue Monitoring');
                            }}
                            className="text-sky-600 hover:text-sky-800 text-xs font-semibold"
                          >
                            View Bio-trend
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-400">
                    No nurses found matching the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Visual Heatmap Grid (Attendance Heatmap) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="text-sm font-bold text-slate-900 mb-3">Live Presence Grid (24-Hour Roster)</h4>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {nurses.map((nurse) => {
            let bgClass = 'bg-slate-100 hover:bg-slate-200 border-slate-200';
            if (nurse.status === 'Active') {
              bgClass = nurse.current_fatigue >= 75 ? 'bg-rose-500 hover:bg-rose-600 border-rose-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white';
            } else if (nurse.status === 'Break') {
              bgClass = 'bg-amber-400 hover:bg-amber-500 border-amber-500 text-white';
            }
            return (
              <div 
                key={nurse.id} 
                title={`${nurse.name} | Fatigue: ${nurse.current_fatigue}% | Status: ${nurse.status}`}
                className={`border rounded-lg p-2 text-center text-xs font-semibold cursor-default transition ${bgClass}`}
              >
                {nurse.nurse_id}
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs justify-center text-slate-500">
          <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-emerald-500"></span> Active (Healthy)</div>
          <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-amber-400"></span> On Break</div>
          <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-rose-500"></span> Active (Fatigued)</div>
          <div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-slate-100 border"></span> Offline</div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
