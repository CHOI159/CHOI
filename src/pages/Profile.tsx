import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogOut, Frown, Mail, ShieldCheck, Heart, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

export function Profile() {
  const { user, profile, signOut } = useAuth();

  if (!user || !profile) return null;

  const stats = [
    { label: '被鸽次数', value: profile.stoodUpCount || 0, icon: Heart, color: 'text-pink-500' },
    { label: '放鸽次数', value: profile.noShowCount || 0, icon: Frown, color: 'text-orange-500' },
  ];

  return (
    <div className="p-6 pt-10">
      <header className="mb-12 text-center">
        <div className="relative inline-block">
          <motion.img
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
            className="w-24 h-24 rounded-2xl bg-black shadow-2xl p-0.5 border border-[#1f1f1f] mb-4"
            alt={user.displayName || ''}
          />
          <div className="absolute -bottom-1 -right-1 bg-[#f43f5e] text-black p-1.5 rounded-lg border-2 border-[#050505]">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-white italic tracking-tight uppercase leading-tight">{profile.displayName}</h1>
        <p className="text-[#444] text-[10px] flex items-center justify-center gap-1.5 font-bold uppercase tracking-widest mt-2">
          {user.email}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-10">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#0d0d0d] p-6 rounded-2xl border border-[#1f1f1f] text-center shadow-lg group hover:border-[#f43f5e]/30 transition-colors"
          >
            <div className={`w-10 h-10 ${stat.color} bg-[#050505] border border-[#1f1f1f] rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-3xl font-light text-white font-mono">{stat.value}</p>
            <p className="text-[9px] text-[#666] uppercase font-bold tracking-[0.2em] mt-2">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="space-y-4">
        <button
          onClick={() => {
            if (confirm('确定要退出登录吗？')) {
              signOut();
            }
          }}
          className="w-full bg-[#0d0d0d] text-white/50 hover:text-white border border-[#1f1f1f] font-bold py-5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
        >
          <LogOut className="w-4 h-4" />
          退出雷达系统
        </button>
        
        <div className="pt-8 text-center">
            <p className="text-[9px] text-[#222] font-black uppercase tracking-[0.4em] leading-relaxed">
            FLAKERADAR · V1.0<br />
            让鸽子无处遁形
            </p>
        </div>
      </div>
    </div>
  );
}
