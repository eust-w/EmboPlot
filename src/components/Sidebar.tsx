import React from 'react';
import { LogOut, Users, X, LayoutGrid, BookOpen, Monitor, User } from 'lucide-react';
import { AppView, AuthUser } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, isOpen = false, onToggle, user, onLogout }) => {
  const MENU_ITEMS = [
    { id: 'rooms' as AppView, icon: <LayoutGrid size={22} />, label: '推演大厅' },
    { id: 'market' as AppView, icon: <BookOpen size={22} />, label: '内容市场' },
    { id: 'assets' as AppView, icon: <Users size={22} />, label: '创作中心' },
    { id: 'profile' as AppView, icon: <User size={22} />, label: '账户资产' },
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col bg-zinc-950 border-r border-white/5 p-6 lg:p-8">
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Monitor size={24} className="text-zinc-950" />
          </div>
          <div>
            <h2 className="text-lg lg:text-xl font-black italic tracking-tighter">PARALLEL</h2>
            <p className="text-[8px] lg:text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Theater Engine</p>
          </div>
        </div>
        {onToggle && (
          <button onClick={onToggle} aria-label="关闭导航" className="lg:hidden p-2 text-zinc-400">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-2 lg:space-y-4">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onViewChange(item.id);
              if (onToggle) onToggle();
            }}
            className={`w-full flex items-center gap-4 px-4 py-3 lg:px-6 lg:py-5 rounded-2xl lg:rounded-[2rem] transition-all group ${
              currentView === item.id 
                ? 'bg-amber-500 text-zinc-950 shadow-xl shadow-amber-500/10' 
                : 'text-zinc-500 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="text-xs lg:text-sm font-bold tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-8 border-t border-white/5">
        <div className="bg-zinc-900 rounded-[2rem] p-4 lg:p-5 relative overflow-hidden border border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-2xl object-cover shrink-0 border border-white/10" />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-zinc-950 flex items-center justify-center font-black shrink-0">
                {user?.avatarChar || 'E'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-zinc-100 truncate">{user?.nickname || '导演'}</p>
              <p className="text-[9px] text-zinc-500 font-mono truncate">{user?.uid || 'SESSION READY'}</p>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                aria-label="退出登录"
                className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>POINTS</span>
            <span className="text-amber-400">{(user?.points || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-72 xl:w-80 h-full shrink-0">
        {sidebarContent}
      </aside>

      <AnimatePresence>
        {isOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 left-0 bottom-0 w-72"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
