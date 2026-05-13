import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogOut, Frown, Mail, ShieldCheck, Heart, Trash2, RefreshCw, Loader2, Map as MapIcon, CalendarDays, Users, Activity as ActivityIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Profile() {
  const { user, profile, signOut } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [funStats, setFunStats] = useState({
    totalDistance: 0,
    activeMonth: '-',
    bestTeammate: '-',
    totalJoined: 0,
    isLoading: true
  });

  useEffect(() => {
    if (!user) return;

    const fetchFunStats = async () => {
      try {
        const q = query(collection(db, 'activities'), limit(50));
        const activitySnaps = await getDocs(q);
        
        let joinedCount = 0;
        let estimatedDistance = 0; // Using a proxy since we don't track historical distance natively yet
        const teammates: Record<string, number> = {};
        const months: Record<string, number> = {};

        // To avoid excessive reads, we only process activities where user is a participant.
        // We'll fetch participants subcollection for each to check.
        await Promise.all(activitySnaps.docs.map(async (activityDoc) => {
          const actData = activityDoc.data();
          const pRef = collection(db, 'activities', activityDoc.id, 'participants');
          const pSnaps = await getDocs(pRef);
          
          let userJoined = false;
          const otherMembers: string[] = [];

          pSnaps.forEach(p => {
             if (p.id === user.uid) userJoined = true;
             else otherMembers.push(p.data().displayName || '神秘鸽子');
          });

          if (userJoined) {
            joinedCount++;
            
            // Calculate months
            const date = actData.startTime?.toDate() || new Date();
            const month = `${date.getMonth() + 1}月`;
            months[month] = (months[month] || 0) + 1;

            otherMembers.forEach(m => {
              teammates[m] = (teammates[m] || 0) + 1;
            });
          }
        }));

        const bestMonth = Object.entries(months).sort((a,b) => b[1]-a[1])[0]?.[0] || '暂无';
        const bestMate = Object.entries(teammates).sort((a,b) => b[1]-a[1])[0]?.[0] || '无';
        
        // Base distance calculation on participation frequency to ensure it stays consistent
        estimatedDistance = joinedCount * 3.5; 

        setFunStats({
          totalDistance: estimatedDistance,
          activeMonth: bestMonth,
          bestTeammate: bestMate,
          totalJoined: joinedCount,
          isLoading: false
        });
        
      } catch (e) {
        console.error('Failed to fetch fun stats:', e);
        setFunStats(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchFunStats();
  }, [user]);

  if (!user || !profile) return null;

  const handleReset = async () => {
    if (!confirm('确定要清除所有的被鸽和放鸽记录吗？从零开始新的监控纪元！')) return;
    
    setIsResetting(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        noShowCount: 0,
        stoodUpCount: 0,
        updatedAt: serverTimestamp()
      });
      alert('数据已清零，重新出发！');
    } catch (error) {
      console.error('Reset failed', error);
      alert('数据充值失败，请稍后重试');
    } finally {
      setIsResetting(false);
    }
  };

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

      <div className="grid grid-cols-2 gap-4 mb-6">
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

      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-3xl p-6 mb-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#f43f5e]/5 blur-3xl rounded-full" />
        <h3 className="text-white font-black uppercase italic tracking-widest text-sm mb-6 flex items-center gap-2">
          <ActivityIcon className="w-5 h-5 text-[#f43f5e]" />
          雷达生涯数据
        </h3>
        
        {funStats.isLoading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="w-6 h-6 text-[#f43f5e] animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                  <MapIcon className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-[#888] text-[10px] font-bold tracking-widest uppercase mb-1">累计监控战绩</p>
                  <p className="text-white text-sm font-medium">出击 <span className="text-[#f43f5e] font-black">{funStats.totalJoined}</span> 次</p>
                </div>
              </div>
              <p className="text-2xl font-black italic text-white font-mono">{funStats.totalDistance.toFixed(1)}<span className="text-xs text-[#666] ml-1">km</span></p>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
                  <CalendarDays className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-[#888] text-[10px] font-bold tracking-widest uppercase mb-1">最活跃出勤月</p>
                  <p className="text-white text-sm font-medium">{funStats.activeMonth}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[#888] text-[10px] font-bold tracking-widest uppercase mb-1">最佳监控搭档</p>
                  <p className="text-white text-sm font-medium truncate max-w-[150px]">{funStats.bestTeammate}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="w-full bg-[#111] text-[#f43f5e] hover:bg-[#1a0a0a] border border-[#f43f5e]/30 font-bold py-5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
        >
          {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          重置战绩数据 (RESET)
        </button>

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
