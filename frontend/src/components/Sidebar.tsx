import React from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  Users, 
  Calendar, 
  BarChart3, 
  Bot, 
  BellRing, 
  Settings, 
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onLogout: () => void;
  username: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, onLogout, username }) => {
  const menuItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'Fatigue Monitoring', label: 'Fatigue Monitoring', icon: Activity },
    { id: 'Replacement Engine', label: 'Replacement Engine', icon: Users },
    { id: 'Shift Optimization', label: 'Shift Optimization', icon: Calendar },
    { id: 'Analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'Knowledge Assistant', label: 'Knowledge Assistant', icon: Bot },
    { id: 'Alerts', label: 'Alerts', icon: BellRing },
    { id: 'Administration', label: 'Administration', icon: Settings },
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      {/* Platform Title / Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white">
          <Activity size={20} />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">Nurse Fatigue</h1>
          <span className="text-[10px] font-medium text-sky-600">INTELLIGENCE PLATFORM</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-sky-50 text-sky-600 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <IconComponent size={18} className={isActive ? 'text-sky-600' : 'text-slate-400'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600 font-semibold uppercase text-sm">
            {username ? username.slice(0, 2) : 'SP'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate uppercase">{username || 'Supervisor'}</p>
            <span className="text-[10px] font-medium text-slate-500 capitalize">Supervisor Node</span>
          </div>
          <button 
            onClick={onLogout}
            title="Sign Out"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
