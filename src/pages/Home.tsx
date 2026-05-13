import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, getDocs, doc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Activity } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { activityService } from '../services/activityService';
import { Calendar, MapPin, PlusCircle, Power, Loader2, Archive as ArchiveIcon, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [shareCodeInput, setShareCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareCodeInput.trim() || isJoining || !user) return;

    setIsJoining(true);
    try {
      const upperCode = shareCodeInput.trim().toUpperCase();
      const q = query(collection(db, 'activities'), where('shareCode', '==', upperCode), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        alert("找不到该分享码对应的活动，请检查后重试！");
        return;
      }

      const docSnapshot = snap.docs[0];
      const docId = docSnapshot.id;
      const activityData = docSnapshot.data() as Activity;

      // Automatically join if not already in participantIds
      if (!activityData.participantIds?.includes(user.uid) && activityData.status === 'active') {
        const pRef = doc(db, `activities/${docId}/participants`, user.uid);
        await setDoc(pRef, {
          uid: user.uid,
          displayName: user.displayName || '匿名用户',
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          status: 'joined',
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        const activityRef = doc(db, 'activities', docId);
        await updateDoc(activityRef, {
          participantIds: arrayUnion(user.uid)
        });
      }

      navigate(`/activity/${docId}`);
    } catch (err: any) {
      console.error(err);
      alert("查询或加入活动出错：" + err.message);
    } finally {
      setIsJoining(false);
    }
  };

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

    // Fetch activities where user is a participant. 
    // We sort client-side to avoid needing a composite index for array-contains + orderBy
    const q = query(
      collection(db, 'activities'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Activity))
        .filter(act => ['active', 'completed'].includes(act.status))
        .sort((a, b) => b.startTime.toMillis() - a.startTime.toMillis())
        .slice(0, 100);
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

      <form onSubmit={handleJoinByCode} className="mb-8 relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-[#444] group-focus-within:text-[#f43f5e] transition-colors" />
        </div>
        <input
          type="text"
          placeholder="输入分享码加入活动..."
          value={shareCodeInput}
          onChange={(e) => setShareCodeInput(e.target.value.toUpperCase())}
          maxLength={6}
          onBlur={() => {
            // keep uppercase when blurring just in case
            setShareCodeInput(prev => prev.toUpperCase());
          }}
          className="w-full bg-[#0d0d0d] border border-[#1f1f1f] text-white rounded-2xl pl-12 pr-28 py-4 focus:ring-1 focus:ring-[#f43f5e] focus:border-[#f43f5e] outline-none transition-all placeholder:text-[#333] font-mono tracking-widest text-lg shadow-2xl"
        />
        <button
          type="submit"
          disabled={isJoining || shareCodeInput.length < 6}
          className="absolute inset-y-2 right-2 px-6 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center gap-2"
        >
          {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : '加入'}
        </button>
      </form>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[180px] bg-[#0d0d0d] rounded-2xl animate-pulse border border-[#1f1f1f] p-6 flex flex-col justify-between overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#f43f5e]/20" />
              <div className="space-y-3">
                <div className="h-6 bg-[#1a1a1a] rounded-md w-3/4" />
                <div className="h-4 bg-[#1a1a1a] rounded-md w-1/3" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-[#1a1a1a] rounded-md w-1/2" />
                <div className="h-4 bg-[#1a1a1a] rounded-md w-full" />
              </div>
            </div>
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
              <ActivityCard 
                key={activity.id} 
                activity={activity} 
                index={index} 
                user={user}
                confirmingId={confirmingId}
                deletingId={deletingId}
                handleArchive={handleArchive}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ActivityCard({ activity, index, user, confirmingId, deletingId, handleArchive }: any) {
  const [isSwiped, setIsSwiped] = useState(false);

  return (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ delay: index * 0.05 }}
        className="relative bg-[#0d0d0d] rounded-2xl border border-[#1f1f1f] shadow-2xl overflow-hidden"
      >
        {/* The Action Background Layer (revealed when swiped left) */}
        {user?.uid === activity.creatorId && (
          <div className="absolute right-0 top-0 bottom-0 w-[100px] flex items-center justify-end pr-4 bg-[#1a1a1a]">
            <button
              type="button"
              onClick={(e) => {
                // If the user clicks confirm, it handles it. 
                // We keep it swiped open while confirming.
                handleArchive(activity.id, e);
              }}
              className={cn(
                "w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all shadow-xl cursor-pointer",
                confirmingId === activity.id 
                  ? "bg-[#f43f5e] text-black border border-white/20 scale-105" 
                  : "bg-zinc-900 border border-white/5 text-[#444] hover:text-[#f43f5e] active:scale-95"
              )}
            >
              {deletingId === activity.id ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Power className={cn("w-6 h-6 mb-1", confirmingId === activity.id && "animate-bounce")} />
                  <span className="text-[9px] font-black uppercase tracking-tighter">
                    {confirmingId === activity.id ? '确定终止' : '终止'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* The Foreground Card Layer */}
        <motion.div
          drag={user?.uid === activity.creatorId ? "x" : false}
          dragConstraints={{ left: -100, right: 0 }}
          dragElastic={0.1}
          animate={{ x: isSwiped ? -100 : 0 }}
          onDragEnd={(e, info) => {
            if (info.offset.x < -40 || info.velocity.x < -100) {
              setIsSwiped(true);
            } else {
              setIsSwiped(false);
            }
          }}
          className="relative block bg-[#0d0d0d] z-10 w-full h-full border-r border-[#1f1f1f]"
        >
          <Link
            to={`/activity/${activity.id}`}
            onClick={(e) => {
              // Prevent navigation if we are actively swiped open, maybe let user close it instead
              if (isSwiped) {
                e.preventDefault();
                setIsSwiped(false);
              }
            }}
            className="block p-6 active:scale-[0.99] transition-all relative group/card"
            draggable={false} // prevent HTML default dragging
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-[#f43f5e] opacity-50 group-hover/card:opacity-100 transition-opacity" />
            
            <div className="flex justify-between items-start mb-6 pointer-events-none">
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
              <div className="text-right pointer-events-none">
                <p className="text-xl font-mono text-[#f43f5e]">{new Date(activity.startTime.toDate()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-[10px] text-[#666] uppercase">{new Date(activity.startTime.toDate()).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[10px] text-[#888] font-bold uppercase tracking-widest pointer-events-none">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[#f43f5e]" />
                <span className="truncate max-w-[200px] text-zinc-500">{activity.location.address}</span>
              </div>
            </div>
          </Link>
        </motion.div>
    </motion.div>
  );
}