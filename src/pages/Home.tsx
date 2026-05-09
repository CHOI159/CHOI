import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Activity } from '../types';
import { Link } from 'react-router-dom';
import { activityService } from '../services/activityService';
import { Calendar, MapPin, PlusCircle, Power, Loader2, Archive as ArchiveIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function Home() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleArchive = async (activityId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log(`[Home] handleArchive clicked for: ${activityId}`);
    
    if (deletingId === activityId) return;

    if (confirmingId !== activityId) {
      setConfirmingId(activityId);
      // Reset confirmation after 3 seconds
      setTimeout(() => setConfirmingId(null), 3000);
      return;
    }

    setDeletingId(activityId);
    setConfirmingId(null);
    try {
      console.log(`[Home] Calling archiveActivity for: ${activityId}`);
      const success = await activityService.archiveActivity(activityId);
      if (success) {
        console.log("[Home] Archive success");
      }
    } catch (err: any) {
      console.error("[Home] Archive failed:", err);
      alert("归档失败: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Fetch sorted by time and filter status client-side to avoid index requirement
    const q = query(
      collection(db, 'activities'),
      orderBy('startTime', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Activity))
        .filter(act => ['active', 'completed'].includes(act.status)); // Show active and completed in Home
      setActivities(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activities');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (activities.length === 0) return;

    const lifecycleCheck = () => {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const oneAndHalfHours = 90 * 60 * 1000;

      activities.forEach(activity => {
        const startTime = activity.startTime.toDate().getTime();
        
        // 1. Auto-Archive (1.5h after start)
        if (now >= startTime + oneAndHalfHours && activity.status !== 'archived') {
          console.log(`[Lifecycle] Auto-archiving activity ${activity.id}`);
          activityService.archiveActivity(activity.id);
        }
        // 2. Auto-Complete (1h after start)
        else if (now >= startTime + oneHour && activity.status === 'active') {
          console.log(`[Lifecycle] Auto-completing activity ${activity.id}`);
          activityService.completeActivity(activity.id);
        }
      });
    };

    const interval = setInterval(lifecycleCheck, 30000); 
    lifecycleCheck(); // Run once immediately
    return () => clearInterval(interval);
  }, [activities]);

  return (
    <div className="p-6 pt-10">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
            正在监控
          </h1>
          <p className="text-[#888] text-xs uppercase tracking-widest mt-1">实时捕捉每一只鸽子</p>
        </div>
        <div className="flex gap-3">
          <Link to="/archive" className="w-10 h-10 bg-[#0d0d0d] border border-[#1f1f1f] rounded-lg flex items-center justify-center text-[#666] active:scale-90 transition-all hover:text-white" title="历史归档">
            <ArchiveIcon className="w-5 h-5" />
          </Link>
          <Link to="/create" className="bg-[#f43f5e] text-black w-10 h-10 rounded-lg flex items-center justify-center shadow-lg shadow-rose-900/20 active:scale-90 transition-transform">
            <PlusCircle className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-32 bg-[#0d0d0d] rounded-2xl animate-pulse border border-[#1f1f1f]" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-20 text-center">
          <div className="w-20 h-20 bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl flex items-center justify-center mb-6">
            <Calendar className="w-8 h-8 text-[#333]" />
          </div>
          <h3 className="text-xl font-bold text-white uppercase italic">暂无活动监控</h3>
          <p className="text-[#666] mt-2 mb-10 max-w-xs text-sm">快去创建一个活动，捕捉你的“鸽子”朋友们。</p>
          <Link
            to="/create"
            className="bg-white text-black font-black py-4 px-10 rounded-xl shadow-lg uppercase tracking-tighter active:scale-95 transition-transform"
          >
            开启监控
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="relative group bg-[#0d0d0d] rounded-2xl border border-[#1f1f1f] shadow-2xl overflow-hidden"
              >
                <Link
                  to={`/activity/${activity.id}`}
                  className="block p-6 pr-16 active:scale-[0.99] transition-all relative group/card"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#f43f5e] opacity-50 group-hover/card:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-2xl font-light text-white tracking-tight">{activity.title}</h2>
                        {activity.status === 'completed' && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-green-500/20 text-green-400 border border-green-500/30">
                            已完成
                          </span>
                        )}
                      </div>
                      <p className="text-[#666] text-[10px] uppercase font-bold tracking-widest mt-0.5">由 {activity.creatorName} 发起</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-mono text-[#f43f5e]">{new Date(activity.startTime.toDate()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-[10px] text-[#666] uppercase">{new Date(activity.startTime.toDate()).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-[#888] font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-[#f43f5e]" />
                      <span className="truncate max-w-[180px] text-zinc-500">{activity.location.address}</span>
                    </div>
                  </div>
                </Link>

                {/* Archive Button - positioned absolutely within the relative motion.div but OUTSIDE the Link */}
                {user?.uid === activity.creatorId && (
                  <button
                    type="button"
                    onClick={(e) => handleArchive(activity.id, e)}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 right-4 w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all z-20 shadow-xl cursor-pointer",
                      confirmingId === activity.id 
                        ? "bg-[#f43f5e] text-black border border-white/20 scale-110" 
                        : "bg-zinc-900 border border-white/5 text-[#444] hover:text-[#f43f5e] active:scale-90"
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {deletingId === activity.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Power className={cn("w-6 h-6 mb-0.5", confirmingId === activity.id && "animate-bounce")} />
                        <span className="text-[7px] font-black uppercase tracking-tighter">
                          {confirmingId === activity.id ? '确定终止' : '终止活动'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
