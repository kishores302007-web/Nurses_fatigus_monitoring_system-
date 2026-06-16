import React, { useState, useEffect } from 'react';
import { useWebSocket } from './context/WebSocketContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { FatigueMonitoring } from './components/FatigueMonitoring';
import { ReplacementEngine } from './components/ReplacementEngine';
import { ShiftOptimization } from './components/ShiftOptimization';
import { Analytics } from './components/Analytics';
import { Alerts } from './components/Alerts';
import { AdminPanel } from './components/AdminPanel';
import { DutyAllotment } from './components/DutyAllotment';
import { Nurse } from './types/types';
import { 
  Bell, 
  Wifi, 
  WifiOff, 
  Clock, 
  Lock,
  Activity,
  AlertOctagon
} from 'lucide-react';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [currentTab, setCurrentTab] = useState('Dashboard');
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [isAlertsDropdownOpen, setIsAlertsDropdownOpen] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  const { isConnected, recentAlerts, clearRecentAlerts } = useWebSocket();

  // Tick clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Check login on startup
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUsername(savedUser);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    const isMatch = (loginForm.username === 'admin1' && loginForm.password === '123') ||
                    (loginForm.username === 'admin2' && loginForm.password === '321');
    
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginForm)
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('auth_token', data.access_token);
        localStorage.setItem('auth_user', loginForm.username);
        setToken(data.access_token);
        setUsername(loginForm.username);
        setIsAuthenticated(true);
      } else {
        // Fallback to local offline check if credentials match user requirements
        if (isMatch) {
          localStorage.setItem('auth_token', 'mock_dev_token');
          localStorage.setItem('auth_user', loginForm.username);
          setToken('mock_dev_token');
          setUsername(loginForm.username);
          setIsAuthenticated(true);
        } else {
          const err = await res.json();
          setLoginError(err.detail || "Incorrect username or password.");
        }
      }
    } catch (err) {
      // Offline mock login fallback
      if (isMatch) {
        localStorage.setItem('auth_token', 'mock_dev_token');
        localStorage.setItem('auth_user', loginForm.username);
        setToken('mock_dev_token');
        setUsername(loginForm.username);
        setIsAuthenticated(true);
      } else {
        setLoginError("Could not connect to backend server. Authorized admin accounts only.");
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUsername('');
    setIsAuthenticated(false);
    setCurrentTab('Dashboard');
    setSelectedNurse(null);
  };

  // Render correct sub-page
  const renderTabContent = () => {
    switch (currentTab) {
      case 'Dashboard':
        return (
          <Dashboard 
            onSelectNurseForReplacement={(nurse) => {
              setSelectedNurse(nurse);
              setCurrentTab('Replacement Engine');
            }} 
            onNavigateToTab={setCurrentTab}
          />
        );
      case 'Fatigue Monitoring':
        return (
          <FatigueMonitoring 
            selectedNurse={selectedNurse}
            onSelectNurse={setSelectedNurse}
          />
        );
      case 'Replacement Engine':
        return (
          <ReplacementEngine 
            selectedNurse={selectedNurse}
            onSelectNurse={setSelectedNurse}
            onNavigateToTab={setCurrentTab}
          />
        );
      case 'Shift Optimization':
        return <ShiftOptimization />;
      case 'Analytics':
        return <Analytics />;
      case 'Alerts':
        return <Alerts />;
      case 'Duty Allotment':
        return <DutyAllotment />;
      case 'Administration':
        return <AdminPanel />;
      default:
        return <Dashboard onSelectNurseForReplacement={setSelectedNurse} onNavigateToTab={setCurrentTab} />;
    }
  };

  // 1. Unauthenticated Login Layout
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-sky-50 via-slate-50 to-teal-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-xl backdrop-blur-md">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500 text-white shadow-md">
              <Activity size={24} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900 leading-none">
              Clinical Sign In
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">Nurse Fatigue Intelligence & Workforce Optimization Platform</p>
          </div>

          {loginError && (
            <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 animate-in fade-in slide-in-from-top-1 duration-150">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Username</label>
              <input
                type="text"
                placeholder="Username (e.g. admin1)"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-semibold">Security Password</label>
              <input
                type="password"
                placeholder="Password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs bg-slate-50 focus:outline-none focus:border-sky-500 focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-lg bg-sky-500 hover:bg-sky-600 py-2.5 text-xs font-bold text-white transition shadow-sm flex items-center justify-center gap-1.5"
            >
              {loggingIn ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <Lock size={14} /> Authorize Session
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Main Authenticated Console Layout
  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar 
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onLogout={handleLogout}
        username={username}
      />

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8 flex-shrink-0">
          {/* Left search/status details */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical Station Console</span>
            
            {/* Live Connection badge */}
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition ${
              isConnected 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                : 'bg-rose-50 border-rose-100 text-rose-700'
            }`}>
              {isConnected ? (
                <>
                  <Wifi size={12} /> Live Broker Connected
                </>
              ) : (
                <>
                  <WifiOff size={12} className="animate-pulse" /> Telemetry Broker Offline
                </>
              )}
            </div>
          </div>

          {/* Right clock & alarms notifications bell */}
          <div className="flex items-center gap-4">
            {/* Clock */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Clock size={14} />
              <span>{time}</span>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsAlertsDropdownOpen(!isAlertsDropdownOpen)}
                className={`rounded-lg border p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition ${
                  recentAlerts.length > 0 ? 'bg-rose-50/50 border-rose-100' : 'border-slate-200 bg-white'
                }`}
              >
                <Bell size={16} className={recentAlerts.length > 0 ? 'text-rose-500 animate-swing' : ''} />
                {recentAlerts.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-extrabold text-white">
                    {recentAlerts.length}
                  </span>
                )}
              </button>

              {/* Collapsible Alerts Dropdown drawer */}
              {isAlertsDropdownOpen && (
                <div className="absolute right-0 mt-2 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                      <AlertOctagon size={14} className="text-rose-500" /> Active Roster Alarms
                    </span>
                    {recentAlerts.length > 0 && (
                      <button 
                        onClick={clearRecentAlerts}
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                      >
                        Dismiss All
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {recentAlerts.length > 0 ? (
                      recentAlerts.map((msgStr, index) => (
                        <div 
                          key={index}
                          onClick={() => {
                            setCurrentTab('Alerts');
                            setIsAlertsDropdownOpen(false);
                          }}
                          className="rounded-lg bg-rose-50/50 border border-rose-100 p-2.5 text-[10px] font-semibold text-rose-900 leading-snug cursor-pointer hover:bg-rose-50 transition"
                        >
                          {msgStr}
                        </div>
                      ))
                    ) : (
                      <p className="py-6 text-center text-[10px] text-slate-400">No active fatigue warnings triggered.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-hidden">
          {renderTabContent()}
        </main>

      </div>
    </div>
  );
};
export default App;
