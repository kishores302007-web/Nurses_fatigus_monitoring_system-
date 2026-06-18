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
    if (score <= 30) return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50';
    if (score <= 60) return 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50';
    if (score <= 80) return 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-900/50';
    return 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/50 animate-pulse';
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === 'Active') return 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/50';
    if (status === 'Break') return 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 border-amber-100 dark:border-amber-900/50';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-450">Loading Clinical Registries...</p>
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
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Ward Attendance & Live Registry</h2>
          <p className="text-xs text-slate-500 dark:text-slate-450">Real-time status of hospital workforce based on wearable IoT telemetry.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 transition shadow-xs"
        >
          <RefreshCw size={14} className="text-purple-500" />
          Sync Data
        </button>
      </div>

      {/* Notice Banner */}
      <div className="rounded-xl border border-purple-200/65 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-xs text-purple-900 dark:text-purple-200 font-semibold leading-relaxed text-left">
          🚀 Notice: Wearable IoT biosensors streaming live telemetry. Machine learning models actively calculating fatigue risk levels and optimizing workforce roster replacements.
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => onNavigateToTab('Duty Allotment')} className="rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 px-3.5 py-1.5 text-[10px] font-black text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-800 transition shadow-xs uppercase">
            Roster Optimizer
          </button>
          <button onClick={() => onNavigateToTab('Shift History')} className="rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-3.5 py-1.5 text-[10px] font-black text-white hover:from-purple-600 hover:to-indigo-750 transition shadow-sm uppercase">
            Clinician Audit Log
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: High Fatigue Alarms */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 dark:from-rose-500 dark:to-pink-650 p-6 text-white shadow-sm hover:shadow-md transition duration-200 text-left">
          {/* Overlapping circle overlays */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -right-2 -bottom-6 h-24 w-24 rounded-full bg-white/15" />
          
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">High Fatigue Alerts (&gt;75)</span>
            <AlertTriangle size={20} className="text-white/80" />
          </div>
          <div className="mt-6 relative z-10">
            <h3 className="text-3xl font-black">{kpis.high_fatigue_nurses}</h3>
            <p className="text-[10px] font-bold text-white/90 mt-2 uppercase tracking-wide">Immediate swaps recommended</p>
          </div>
        </div>

        {/* Card 2: Active Roster Presence */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-400 to-indigo-500 dark:from-blue-500 dark:to-indigo-650 p-6 text-white shadow-sm hover:shadow-md transition duration-200 text-left">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -right-2 -bottom-6 h-24 w-24 rounded-full bg-white/15" />
          
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">Active On-Site Clinicians</span>
            <Activity size={20} className="text-white/80" />
          </div>
          <div className="mt-6 relative z-10">
            <h3 className="text-3xl font-black">{kpis.active_nurses}</h3>
            <p className="text-[10px] font-bold text-white/90 mt-2 uppercase tracking-wide">Roster Capacity Coverage: {kpis.shift_coverage_pct}%</p>
          </div>
        </div>

        {/* Card 3: Available Swaps pool */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 dark:from-teal-500 dark:to-emerald-650 p-6 text-white shadow-sm hover:shadow-md transition duration-200 text-left">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -right-2 -bottom-6 h-24 w-24 rounded-full bg-white/15" />
          
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">Available Standby Swaps</span>
            <Users size={20} className="text-white/80" />
          </div>
          <div className="mt-6 relative z-10">
            <h3 className="text-3xl font-black">{kpis.available_replacements}</h3>
            <p className="text-[10px] font-bold text-white/90 mt-2 uppercase tracking-wide">Clinicians with Fatigue &lt; 40% (Total Registered: {kpis.total_nurses})</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {chartData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Department presence bar chart */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm lg:col-span-2 text-left">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Department-wise Staff Presence</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:hidden" />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" className="hidden dark:block" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight="bold" />
                  <YAxis stroke="#64748b" fontSize={11} fontWeight="bold" />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }} 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    className="dark:hidden"
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="Active" fill="#b66dff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Standby" fill="#94a3b8" radius={[4, 4, 0, 0]} className="dark:hidden" />
                  <Bar dataKey="Standby" fill="#334155" radius={[4, 4, 0, 0]} className="hidden dark:block" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Shift Distribution Pie Chart */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm text-left">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Roster Allocation</h4>
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.shift_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.shift_distribution.map((entry: any, index: number) => {
                      const pieColors = ['#b66dff', '#4fa6ff', '#00e676'];
                      return <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />;
                    })}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-col gap-2 justify-center">
              {chartData.shift_distribution.map((entry: any, index: number) => {
                const pieColors = ['#b66dff', '#4fa6ff', '#00e676'];
                return (
                  <div key={entry.name} className="flex items-center justify-between text-xs px-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }}></span>
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">{entry.name}</span>
                    </div>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{entry.value} Nurses</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Roster & Search Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between text-left">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Nurse Registry & Live Biosignals</h4>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex items-center rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 focus-within:border-purple-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent pl-2 text-xs text-slate-750 dark:text-slate-200 focus:outline-none w-48 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            {/* Department Dropdown */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none focus:border-purple-500"
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
              <tr className="border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="px-6 py-3.5">Nurse ID</th>
                <th className="px-6 py-3.5">Nurse Name</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Shift Duration</th>
                <th className="px-6 py-3.5">Current Status</th>
                <th className="px-6 py-3.5">Device Signal</th>
                <th className="px-6 py-3.5">Last Seen</th>
                <th className="px-6 py-3.5 text-center">Fatigue Index</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-650 dark:text-slate-350">
              {filteredNurses.length > 0 ? (
                filteredNurses.map((nurse) => {
                  const isHighFatigue = nurse.current_fatigue >= 75;
                  return (
                    <tr key={nurse.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="px-6 py-4 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {nurse.nurse_id}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                        {nurse.name}
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        {nurse.department}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {nurse.status === 'Offline' ? '0.0h' : `${nurse.work_hours}h`}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${getStatusBadgeClass(nurse.status)}`}>
                          {nurse.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {nurse.device_status === 'Active' ? (
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-450 font-bold">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Connected
                          </span>
                        ) : nurse.device_status === 'Disconnected' ? (
                          <span className="flex items-center gap-1.5 text-rose-500 font-bold animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span> Signal Lost
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 font-semibold">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-[10px] text-slate-500">
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
                            className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-purple-500 to-indigo-650 px-2.5 py-1.5 text-[10px] font-black text-white hover:from-purple-600 hover:to-indigo-750 transition shadow-sm uppercase"
                          >
                            Swap Staff
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              onSelectNurseForReplacement(nurse);
                              onNavigateToTab('Fatigue Monitoring');
                            }}
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 text-xs font-bold"
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
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-400 dark:text-slate-500">
                    No nurses found matching the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Visual Heatmap Grid */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm text-left">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Live Presence Grid (24-Hour Roster)</h4>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {nurses.map((nurse) => {
            let bgClass = 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400';
            if (nurse.status === 'Active') {
              bgClass = nurse.current_fatigue >= 75 
                ? 'bg-rose-500 hover:bg-rose-600 border-rose-600 text-white' 
                : 'bg-purple-500 hover:bg-purple-600 border-purple-600 text-white shadow-sm';
            } else if (nurse.status === 'Break') {
              bgClass = 'bg-amber-400 hover:bg-amber-500 border-amber-500 text-white';
            }
            return (
              <div 
                key={nurse.id} 
                title={`${nurse.name} | Fatigue: ${nurse.current_fatigue}% | Status: ${nurse.status}`}
                className={`border rounded-lg p-2 text-center text-[10px] font-bold cursor-default transition ${bgClass}`}
              >
                {nurse.nurse_id}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-[10px] justify-center text-slate-500 dark:text-slate-450 font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-purple-500"></span> Active (Healthy)</div>
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-400"></span> On Break</div>
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-rose-500"></span> Active (Fatigued)</div>
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800"></span> Offline</div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
