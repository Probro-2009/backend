import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Home, MessageCircle, Settings, Sparkles, Film, LogOut, Shield, Sun, Moon } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/messages', icon: MessageCircle, label: 'Messages' },
  { to: '/ai', icon: Sparkles, label: 'AI' },
  { to: '/reels', icon: Film, label: 'Reels' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <aside className="h-screen sticky top-0 border-r border-border flex flex-col justify-between p-6 bg-background" data-testid="sidebar">
      <div>
        <div className="flex items-center gap-2.5 mb-10 cursor-pointer" onClick={() => navigate('/')} data-testid="sidebar-logo">
          <div className="w-9 h-9 rounded-sm bg-[#0055FF] flex items-center justify-center flex-shrink-0">
            <Shield className="w-4.5 h-4.5 text-white" size={18} />
          </div>
          <span className="font-heading text-xl font-light tracking-tight text-foreground">T.P</span>
        </div>

        <nav className="space-y-1" data-testid="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium transition-all group
                ${isActive ? 'bg-[#0055FF]/10 text-[#0055FF]' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`
              }
              data-testid={`nav-${item.label.toLowerCase()}`}>
              <item.icon size={20} className="flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="space-y-3">
        <button onClick={toggleTheme} data-testid="theme-toggle-btn"
          className="flex items-center gap-3 px-4 py-3 rounded-sm text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all w-full">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {user && (
          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted rounded-sm transition-colors"
              onClick={() => navigate(`/profile/${user.username}`)} data-testid="sidebar-user-profile">
              <div className="w-9 h-9 rounded-full bg-surface-elevated flex items-center justify-center overflow-hidden flex-shrink-0">
                {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> :
                  <span className="text-sm font-medium text-foreground">{user.username?.[0]?.toUpperCase()}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.display_name}</p>
                <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
              </div>
            </div>
            <button onClick={logout} data-testid="logout-btn"
              className="flex items-center gap-3 px-4 py-2.5 mt-1 rounded-sm text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all w-full">
              <LogOut size={18} /> <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
