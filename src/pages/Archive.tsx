import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Activity } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, ArrowLeft, Archive as ArchiveIcon, CheckCircle2, XCircle, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { activityService } from '../services/activityService';
import { cn } from '../lib/utils';

export function Archive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleDelete = async (activityId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (deletingId === activityId) return;

    if (confirmingId !== activityId) {
      setConfirmingId(activityId);
      setTimeout(() => setConfirmingId(null), 3000);
      return;
    }

    setDeletingId(activityId);
    setConfirmingId(null);
    try {
      await activityService.permanentDelete(activityId);
      console.log("[Archive] Permanent delete success");
    } catch (err: any) {
      console.error("[Archive] Delete failed:", err);
      alert("删除失败: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Fetch activities where user is participant
    const q = query(
      collection(db, 'activities'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const archivedStatuses = ['archived', 'cancelled'];
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Activity))
        .filter(act => archivedStatuses.includes(act.status))
        .sort((a, b) => {
          const aTime = a.startTime?.toMillis ? a.startTime.toMillis() : 0;
          const bTime = b.startTime?.toMillis ? b.startTime.toMillis() : 0;
          return bTime - aTime;
        })
        .slice(0, 200);
      setActivities(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activities');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="p-6 pt-10 min-h-screen bg-[#050505]">
      <header className="mb-10 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-[#0d0d0d] border border-[#1f1f1f] rounded-lg flex items-center justify-center text-[#666] active:scale-90 transition-all hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
            历史归档
          </h1>
          <p className="text-[#444] text-[10px] uppercase tracking-widest mt-0.5">那些已经结束的传说</p>
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-[#0d0d0d]/30 rounded-2xl animate-pulse border border-[#1f1f1f]/30" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-20 text-center opacity-30">
          <ArchiveIcon className="w-12 h-12 text-[#333] mb-4" />
          <h3 className="text-lg font-bold text-white uppercase italic">归档库为空</h3>
          <p className="text-[#666] mt-1 text-xs">只有终结的监控任务才会出现在这里。</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <div className="relative">
                  <Link
                    to={`/activity/${activity.id}`}
                    className="block bg-[#0d0d0d]/40 p-4 pr-16 rounded-xl border border-[#1f1f1f]/40 hover:border-[#1f1f1f] transition-all relative overflow-hidden group"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          activity.status === 'completed' ? 'bg-green-500/10 text-green-500/50' : 
                          activity.status === 'cancelled' ? 'bg-orange-500/10 text-orange-500/50' : 
                          'bg-gray-500/10 text-gray-500/50'
                        }`}>
                          {activity.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : 
                          activity.status === 'cancelled' ? <XCircle className="w-5 h-5" /> : 
                          <ArchiveIcon className="w-5 h-5" />}
                        </div>
                        
                        <div>
                          <h2 className="text-lg font-medium text-[#666] group-hover:text-white transition-colors">{activity.title}</h2>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[8px] font-black uppercase px-1 rounded ${
                              activity.status === 'completed' ? 'text-green-500/40 bg-green-500/5' : 
                              activity.status === 'cancelled' ? 'text-orange-500/40 bg-orange-500/5' : 
                              'text-gray-500/40 bg-white/5'
                            }`}>
                              {activity.status === 'completed' ? '已达成' : 
                              activity.status === 'cancelled' ? '已取消' : '已归档'}
                            </span>
                            <span className="text-[10px] text-[#333] font-mono">
                              {new Date(activity.startTime.toDate()).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-1 text-[#333] text-[10px] uppercase font-bold tracking-widest">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[80px]">{activity.location.address.split(' ')[0]}</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Permanent Delete Button */}
                  {user?.uid === activity.creatorId && (
                    <button
                      onClick={(e) => handleDelete(activity.id, e)}
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all z-10",
                        confirmingId === activity.id 
                          ? "bg-rose-500 text-black scale-110" 
                          : "bg-zinc-900/50 text-[#333] hover:text-rose-500 hover:bg-zinc-800"
                      )}
                    >
                      {deletingId === activity.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className={cn("w-5 h-5", confirmingId === activity.id && "animate-bounce")} />
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
