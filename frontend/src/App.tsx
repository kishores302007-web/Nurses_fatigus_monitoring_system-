import React, { useState, useEffect } from 'react';
import { useWebSocket } from './context/WebSocketContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { FatigueMonitoring } from './components/FatigueMonitoring';
import { ReplacementEngine } from './components/ReplacementEngine';
import { Alerts } from './components/Alerts';
import { AdminPanel } from './components/AdminPanel';
import { DutyAllotment } from './components/DutyAllotment';
import { HistoryDashboard } from './components/HistoryDashboard';
import { Nurse } from './types/types';
import { 
  Bell, 
  Wifi, 
  WifiOff, 
  Clock, 
  Lock,
  Activity,
  AlertOctagon,
  Sun,
  Moon,
  Mail,
  Search,
  LogOut
} from 'lucide-react';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [currentTab, setCurrentTab] = useState('Dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Handle Light/Dark theme initialization
  useEffect(() => {
    setTheme('light');
    document.documentElement.classList.remove('dark');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
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
      case 'Alerts':
        return <Alerts />;
      case 'Duty Allotment':
        return <DutyAllotment />;
      case 'Shift History':
        return <HistoryDashboard />;
      case 'Administration':
        return <AdminPanel />;
      default:
        return <Dashboard onSelectNurseForReplacement={setSelectedNurse} onNavigateToTab={setCurrentTab} />;
    }
  };

  // 1. Unauthenticated Login Layout
  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 overflow-hidden select-none">
        {/* Floating background blobs */}
        <div className="liquid-blob-container">
          <div className="liquid-blob blob-pink"></div>
          <div className="liquid-blob blob-violet"></div>
          <div className="liquid-blob blob-blue"></div>
        </div>

        <div className="w-full max-w-md rounded-2xl glass-card bg-white/40 p-8 shadow-xl border border-white/60 z-10 relative">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <Activity size={24} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900 leading-none">
              Clinical Sign In
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">RESTAWARE Fatigue Intelligence Platform</p>
          </div>

          {loginError && (
            <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50/50 p-3 text-xs font-semibold text-rose-700 animate-in fade-in slide-in-from-top-1 duration-150 text-left">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Username</label>
              <input
                type="text"
                placeholder="Username (e.g. admin1)"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs bg-white/50 text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Security Password</label>
              <input
                type="password"
                placeholder="Password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs bg-white/50 text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-lg bg-violet-600 hover:bg-violet-750 py-2.5 text-xs font-bold text-white transition shadow-sm flex items-center justify-center gap-1.5 uppercase"
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
    <div className="relative flex h-screen w-screen bg-slate-50 overflow-hidden text-slate-800 select-none">
      {/* Floating background blobs */}
      <div className="liquid-blob-container">
        <div className="liquid-blob blob-pink"></div>
        <div className="liquid-blob blob-violet"></div>
        <div className="liquid-blob blob-blue"></div>
      </div>

      {/* Sidebar navigation */}
      <Sidebar 
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onLogout={handleLogout}
        username={username}
      />

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden z-10 bg-transparent">
        
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-white/20 bg-white/35 backdrop-blur-md px-8 flex-shrink-0">
          
          {/* Left search bar */}
          <div className="flex items-center gap-3 w-64 md:w-80">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search projects, clinicians..."
              className="bg-transparent text-xs text-slate-705 focus:outline-none w-full placeholder-slate-400"
            />
          </div>

          {/* Right utility items */}
          <div className="flex items-center gap-4">
            
            {/* Live Connection badge */}
            <div className={`hidden lg:flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition ${
              isConnected 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                : 'bg-rose-50 border-rose-100 text-rose-700'
            }`}>
              {isConnected ? (
                <>
                  <Wifi size={12} /> Live
                </>
              ) : (
                <>
                  <WifiOff size={12} className="animate-pulse" /> Offline
                </>
              )}
            </div>

            {/* Clock */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Clock size={14} />
              <span>{time}</span>
            </div>

            {/* Mail Icon */}
            <div className="rounded-lg border border-white/30 bg-white/20 backdrop-blur-xs p-2 text-slate-500 hover:bg-white/40 hover:text-slate-800 transition relative cursor-pointer shadow-xs">
              <Mail size={15} />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-amber-500"></span>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsAlertsDropdownOpen(!isAlertsDropdownOpen)}
                className={`rounded-lg border transition shadow-xs ${
                  recentAlerts.length > 0 
                    ? 'bg-rose-50/50 border-rose-200 text-rose-600' 
                    : 'border-white/30 bg-white/20 backdrop-blur-xs text-slate-500 hover:bg-white/40'
                }`}
              >
                <Bell size={15} className={recentAlerts.length > 0 ? 'text-rose-500 animate-swing' : ''} />
                {recentAlerts.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-extrabold text-white">
                    {recentAlerts.length}
                  </span>
                )}
              </button>

              {/* Collapsible Alerts Dropdown drawer */}
              {isAlertsDropdownOpen && (
                <div className="absolute right-0 mt-2 z-50 w-80 rounded-xl glass-card bg-white/60 p-4 shadow-xl border border-white/40 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <span className="text-xs font-bold text-slate-850 uppercase tracking-wider flex items-center gap-1">
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

            {/* Sun/Moon Theme Toggler */}
            <button 
              onClick={toggleTheme} 
              title={theme === 'light' ? "Switch to Night Mode" : "Switch to Light Mode"}
              className="rounded-lg border border-white/30 bg-white/20 backdrop-blur-xs p-2 text-slate-500 hover:bg-white/40 hover:text-slate-850 transition"
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            <span className="h-6 w-[1px] bg-slate-200/50"></span>

            {/* Supervisor Profile Widget */}
            <div className="flex items-center gap-2">
              <div className="relative cursor-pointer">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-violet-500 to-sky-500 text-white font-bold text-xs uppercase shadow-sm">
                  {username ? username.slice(0, 2) : 'SP'}
                </div>
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border-2 border-white"></span>
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-[11px] font-bold text-slate-800 leading-none capitalize">{username || 'Supervisor'}</span>
                <span className="text-[8px] font-semibold text-slate-400 mt-0.5">Roster Manager</span>
              </div>
            </div>

            {/* Power Exit / Logout Button */}
            <button
              onClick={handleLogout}
              title="Session Sign Out"
              className="rounded-lg border border-rose-100 p-2 text-rose-500 hover:bg-rose-50 transition cursor-pointer"
            >
              <LogOut size={15} />
            </button>

          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-hidden bg-transparent">
          {renderTabContent()}
        </main>

      </div>
    </div>
  );
};
export default App;
