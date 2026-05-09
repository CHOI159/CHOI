import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types';
import { Trophy, Share2, Medal, Frown, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function Leaderboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('noShowCount', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleShare = () => {
    const text = `看看这这群“鸽王”排行榜，至今为止谁放鸽子最多！快来加入我们一起捉鸽子：${window.location.origin}`;
    if (navigator.share) {
      navigator.share({
        title: '放鸽子排行榜',
        text: text,
        url: window.location.origin,
      });
    } else {
      navigator.clipboard.writeText(text);
      alert('排行榜分享语已复制！');
    }
  };

  return (
    <div className="p-6 pt-10">
      <header className="flex justify-between items-start mb-10">
        <div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">鸽王战报</h1>
          <p className="text-[#666] text-[10px] uppercase font-bold tracking-[0.2em] mt-1">THE WALL OF SHAME</p>
        </div>
        <button
          onClick={handleShare}
          className="w-10 h-10 bg-[#0d0d0d] rounded-lg border border-[#1f1f1f] flex items-center justify-center text-[#f43f5e] active:scale-90 transition-transform"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#f43f5e]" />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user, index) => (
            <motion.div
              key={user.uid}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-all",
                index === 0 
                  ? "bg-[#1a1313] border-[#f43f5e]/30 shadow-2xl" 
                  : "bg-[#0d0d0d] border-[#1f1f1f] grayscale-[0.5] hover:grayscale-0"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "text-2xl font-black italic w-8",
                  index === 0 ? "text-[#f43f5e]" : "text-[#333]"
                )}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="relative">
                  <img
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                    className={cn(
                      "w-10 h-10 rounded-lg bg-black p-0.5",
                      index === 0 ? "border border-[#f43f5e]/50 shadow-lg shadow-rose-900/40" : "border border-[#1f1f1f]"
                    )}
                    alt={user.displayName}
                  />
                </div>
                <div>
                  <p className={cn("text-sm font-black tracking-tight", index === 0 ? "text-white" : "text-[#888]")}>{user.displayName}</p>
                  <p className="text-[9px] text-[#444] font-bold uppercase tracking-widest mt-0.5">
                    {index === 0 ? '🏆 宇宙级鸽神' : index < 3 ? '🥈 职业级鸽王' : '🥉 预备役鸽子'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className={cn("text-xl font-mono leading-none", index === 0 ? "text-[#f43f5e]" : "text-white")}>{user.noShowCount}</p>
                <p className="text-[8px] font-black uppercase tracking-tighter text-[#444] mt-1">累计鸽数</p>
              </div>
            </motion.div>
          ))}
          
          {users.length === 0 && (
            <div className="text-center py-24 opacity-10 select-none grayscale">
              <Trophy className="w-16 h-16 mx-auto mb-4" />
              <p className="font-black italic uppercase tracking-widest text-sm">世界和平：暂无鸽影</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 p-5 bg-[#0d0d0d] rounded-xl border border-dashed border-[#1f1f1f] text-center">
        <p className="text-[10px] text-[#444] uppercase font-bold tracking-widest">信誉度算法已开启</p>
        <p className="text-[9px] text-[#666] mt-2 italic">系统将自动评估您的每一次放鸽子行为</p>
      </div>
    </div>
  );
}
