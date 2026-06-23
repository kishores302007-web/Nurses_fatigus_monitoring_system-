import React, { useEffect, useState } from 'react';
import { Alert } from '../types/types';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  CheckCircle, 
  AlertOctagon,
  RefreshCw,
  Clock
} from 'lucide-react';

export const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/v1/alerts');
      const data = await res.json();
      setAlerts(data);
    } catch (err) {
      console.error("Error loading alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/v1/alerts/${alertId}/resolve`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchAlerts();
      }
    } catch (err) {
      console.error("Error resolving alert:", err);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'Critical':
        return <AlertOctagon className="text-pink-500" size={18} />;
      case 'High':
        return <AlertOctagon className="text-amber-500" size={18} />;
      default:
        return <AlertOctagon className="text-sky-500" size={18} />;
    }
  };

  const getAlertBadgeClass = (type: string) => {
    switch (type) {
      case 'Critical':
        return 'bg-pink-50 text-pink-700 border-pink-100';
      case 'High':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-sky-50 text-sky-700 border-sky-100';
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterType === 'All') return true;
    if (filterType === 'Active') return !a.resolved;
    if (filterType === 'Resolved') return a.resolved;
    return a.alert_type === filterType;
  });

  return (
    <div className="h-full space-y-6 overflow-y-auto px-8 py-6 bg-transparent text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/20 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Alert Dispatch Center</h2>
          <p className="text-sm text-slate-500">Real-time alert dispatch log tracking Low, High, and Critical thresholds.</p>
        </div>
        <button 
          onClick={fetchAlerts}
          className="flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/45 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white/65 transition shadow-sm"
        >
          <RefreshCw size={14} className="text-violet-600" /> Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/20 pb-3">
        {['All', 'Active', 'Resolved', 'Critical', 'High', 'Low'].map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
              filterType === t 
                ? 'bg-violet-600 border-violet-500 text-white shadow-sm hover:bg-violet-700' 
                : 'bg-white/45 border-white/60 text-slate-650 hover:bg-white/65 backdrop-blur-xs'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Alerts Grid/Table */}
      <div className="rounded-xl border border-white/60 glass-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm font-semibold text-slate-500 flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"></div>
            Loading active alarms...
          </div>
        ) : filteredAlerts.length > 0 ? (
          <div className="divide-y divide-white/10">
            {filteredAlerts.map((alert) => (
              <div 
                key={alert.id}
                className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                  alert.resolved ? 'bg-white/10' : 'bg-pink-50/20'
                }`}
              >
                {/* Left: Nurse and Alarm Score info */}
                <div className="flex items-start gap-3 text-left">
                  <div className="mt-0.5 flex-shrink-0">
                    {getAlertIcon(alert.alert_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{alert.nurse_name}</span>
                      <span className="text-[10px] font-mono text-slate-400 font-medium">({alert.nurse_code})</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${getAlertBadgeClass(alert.alert_type)}`}>
                        {alert.alert_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 font-medium">{alert.description}</p>
                    
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={11} /> {new Date(alert.timestamp).toLocaleTimeString()} ({new Date(alert.timestamp).toLocaleDateString()})</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-600">Fatigue Score: {alert.fatigue_score}%</span>
                    </div>
                  </div>
                </div>

                {/* Center: Notification Dispatch Indicators */}
                <div className="flex items-center gap-4 text-xs font-semibold text-left">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Channels Sent</span>
                    <div className="flex items-center gap-3 text-slate-500">
                      <div className="flex items-center gap-1 text-[10px]" title="SMS Sent">
                        <MessageSquare size={13} className="text-emerald-500" />
                        <span>SMS</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]" title="Email Dispatched">
                        <Mail size={13} className="text-sky-500" />
                        <span>Mail</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]" title="App Push Notification">
                        <Smartphone size={13} className="text-sky-500" />
                        <span>Push</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]" title="Console Toast Broadcasted">
                        <Bell size={13} className="text-emerald-500" />
                        <span>Console</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end">
                  {alert.resolved ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50/70 px-3 py-1.5 rounded-lg border border-emerald-100/50">
                      <CheckCircle size={14} /> Resolved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleResolveAlert(alert.id)}
                      className="rounded-lg bg-white/50 hover:bg-white/70 border border-white/60 px-3 py-1.5 text-xs font-bold text-violet-705 transition shadow-xs animate-in fade-in"
                    >
                      Acknowledge & Dismiss
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-xs text-slate-400">
            No alerts logged for the current filter category.
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
