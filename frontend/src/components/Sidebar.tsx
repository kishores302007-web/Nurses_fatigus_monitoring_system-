import { 
  LayoutDashboard, 
  Activity, 
  Users, 
  BellRing, 
  Settings, 
  LogOut,
  CalendarPlus,
  History
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
    { id: 'Duty Allotment', label: 'Duty Allotment', icon: CalendarPlus },
    { id: 'Shift History', label: 'Shift History', icon: History },
    { id: 'Alerts', label: 'Alerts', icon: BellRing },
    { id: 'Administration', label: 'Administration', icon: Settings },
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-r border-white/20 bg-white/25 backdrop-blur-lg shrink-0">
      {/* Platform Title / Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/20 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-500 to-sky-500 text-white shadow-sm">
          <Activity size={20} />
        </div>
        <div className="text-left">
          <h1 className="text-base font-black tracking-wider text-slate-900 uppercase leading-none">
            <span className="text-violet-600">REST</span>AWARE
          </h1>
        </div>
      </div>

      {/* User Info (Top of Sidebar) */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10 bg-white/15">
        <div className="relative">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-violet-400 to-sky-500 text-white font-bold text-sm uppercase shadow-sm">
            {username ? username.slice(0, 2) : 'SP'}
          </div>
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-black text-slate-800 truncate uppercase leading-none">{username || 'Supervisor'}</p>
          <span className="text-[9px] font-bold text-slate-450 mt-1 block">Project Manager</span>
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
              className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-all duration-150 ${
                isActive 
                  ? 'bg-white/55 text-violet-600 border-l-2 border-violet-500 shadow-xs backdrop-blur-xs' 
                  : 'text-slate-500 hover:bg-white/20 hover:text-slate-900'
              }`}
            >
              <IconComponent size={16} className={isActive ? 'text-violet-500' : 'text-slate-400'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-white/20 p-4 shrink-0 flex flex-col gap-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50/50 transition-all duration-150"
        >
          <LogOut size={16} />
          Sign Out
        </button>
        <div className="text-center">
          <span className="text-[9px] font-bold text-slate-400 tracking-wider">v2.1.0 • CLINICAL NODE</span>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
