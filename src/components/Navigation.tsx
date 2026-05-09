import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, PlusSquare, Trophy, User } from 'lucide-react';
import { cn } from '../lib/utils';

export function Navigation() {
  const navItems = [
    { to: '/', icon: Home, label: '首页' },
    { to: '/create', icon: PlusSquare, label: '发起' },
    { to: '/leaderboard', icon: Trophy, label: '排行榜' },
    { to: '/profile', icon: User, label: '我的' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a] border-t border-[#1f1f1f] pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center w-full h-full transition-all",
                isActive ? "text-[#f43f5e]" : "text-[#444]"
              )
            }
          >
            <Icon className={cn("w-6 h-6", label === '首页' ? "fill-current" : "")} />
            <span className="text-[10px] mt-1 font-bold tracking-widest uppercase">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
