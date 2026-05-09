import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, setDoc, deleteDoc, serverTimestamp, increment, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Activity, Participant } from '../types';
import { activityService } from '../services/activityService';
import { MapPin, Calendar, Clock, Share2, Users, Map as MapIcon, XCircle, CheckCircle2, Navigation, Loader2, ArrowLeft, Trash2, Edit3, PlusCircle, Power, Archive as ArchiveIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn, formatDistance, formatTime } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for participants
const createParticipantIcon = (photoURL: string, displayName: string, isMe: boolean) => {
  return L.divIcon({
    className: 'custom-participant-icon',
    html: `
      <div class="flex flex-col items-center group">
        <div class="relative">
          ${isMe ? '<div class="absolute inset-0 bg-white rounded-full animate-ping opacity-20 scale-150"></div>' : ''}
          <img 
            src="${photoURL}" 
            class="w-10 h-10 rounded-full border-2 ${isMe ? 'border-white' : 'border-blue-500'} bg-black shadow-2xl relative z-10"
            alt="${displayName}"
          />
          <div class="absolute -bottom-1 -right-1 w-3 h-3 ${isMe ? 'bg-green-500' : 'bg-blue-500'} rounded-full border-2 border-black flex items-center justify-center">
            <div class="w-1 h-1 bg-white rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
};

const destinationIcon = L.divIcon({
  className: 'custom-destination-icon',
  html: `
    <div class="flex flex-col items-center">
      <div class="bg-[#f43f5e] p-2 rounded-full border-2 border-white shadow-xl animate-bounce">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div class="bg-[#f43f5e] text-black text-[10px] font-black px-2 py-0.5 rounded mt-1 uppercase tracking-tighter italic">
        目标位置
      </div>
    </div>
  `,
  iconSize: [60, 60],
  iconAnchor: [30, 45]
});

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userParticipant, setUserParticipant] = useState<Participant | null>(null);
  const [currentUserLocation, setCurrentUserLocation] = useState<{lat: number, lng: number} | null>(null);
  
  // Real-time tracking state
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [confirmingNoShow, setConfirmingNoShow] = useState(false);
  const [confirmingArrival, setConfirmingArrival] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  useEffect(() => {
    if (!id) return;

    const activityRef = doc(db, 'activities', id);
    const activityUnsub = onSnapshot(activityRef, (snapshot) => {
      if (!snapshot.exists()) {
        navigate('/');
        return;
      }
      setActivity({ id: snapshot.id, ...snapshot.data() } as Activity);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `activities/${id}`);
    });

    const participantsRef = collection(db, `activities/${id}/participants`);
    const participantsUnsub = onSnapshot(participantsRef, (snapshot) => {
      const dataMap: Record<string, Participant> = {};
      snapshot.docs.forEach(doc => {
        const pData = doc.data() as Participant;
        const uid = pData.uid || doc.id;
        // Use the UID field as the map key to strictly deduplicate
        dataMap[uid] = { ...pData, uid };
      });
      const data = Object.values(dataMap);
      setParticipants(data);
      if (user) {
        setUserParticipant(data.find(p => p.uid === user.uid) || null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `activities/${id}/participants`);
      setLoading(false);
    });

    return () => {
      activityUnsub();
      participantsUnsub();
    };
  }, [id, user]);

  // Logic to activate tracking - only 1 hour before start, and STOP if archived
  useEffect(() => {
    if (!activity || !user || !userParticipant) return;
    
    // Tracking condition
    if (userParticipant.status !== 'joined' || activity.status === 'archived' || activity.status === 'cancelled') {
      setTrackingActive(false);
    }

    const checkTime = () => {
      const startTime = activity.startTime.toDate().getTime();
      const now = Date.now();
      const thirtyMins = 30 * 60 * 1000;
      const oneHour = 60 * 60 * 1000;

      // Only creator or admin can trigger auto-lifecycle updates to avoid permission errors for participants
      const isPrivileged = user.uid === activity.creatorId || user.email === 'choihou95@gmail.com';

      // 1. Auto-Archive (1h after start - which is 30m after auto-complete)
      if (isPrivileged && now >= startTime + oneHour && activity.status !== 'archived') {
        console.log("[Lifecycle] Auto-archiving activity");
        activityService.archiveActivity(activity.id).catch(e => console.warn("Auto-archive failed:", e));
        return;
      }

      // 2. Auto-Complete (30m after start)
      if (isPrivileged && now >= startTime + thirtyMins && activity.status === 'active') {
        console.log("[Lifecycle] Auto-completing activity");
        activityService.completeActivity(activity.id).catch(e => console.warn("Auto-complete failed:", e));
      }

      // 3. Tracking active from 1 hour before until archived
      if (userParticipant.status === 'joined' && now >= startTime - (60 * 60 * 1000) && activity.status !== 'archived' && activity.status !== 'cancelled') {
        setTrackingActive(true);
      } else {
        setTrackingActive(false);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 10000);

    return () => clearInterval(interval);
  }, [activity?.startTime, activity?.status, userParticipant?.status, user?.uid]);

  const getRouteInfo = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=false`);
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        return {
          distance: data.routes[0].distance, // in meters
          duration: data.routes[0].duration * 1000 // in ms
        };
      }
    } catch (err) {
      console.error("[Routing] Failed to fetch OSRM route:", err);
    }
    
    // Fallback to Haversine with coefficient
    const d = getDistance(startLat, startLng, endLat, endLng) * 1000;
    return {
      distance: d * 1.3, // Road distance is usually 30% longer
      duration: (d * 1.3 / 11.1) * 1000 
    };
  };

  const updateLocationInfo = async () => {
    if (!activity || !navigator.geolocation) return;
    setCheckingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const targetLat = activity.location.lat;
        const targetLng = activity.location.lng;

        const route = await getRouteInfo(userLat, userLng, targetLat, targetLng);
        setDistance(route.distance);
        setDuration(route.duration);

        // Auto-arrive if within 100m
        if (route.distance < 100 && userParticipant?.status === 'joined') {
          handleArrival();
        }

        if (userParticipant && id) {
          const pRef = doc(db, `activities/${id}/participants`, userParticipant.uid);
          setDoc(pRef, {
            location: {
              lat: userLat,
              lng: userLng
            },
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `activities/${id}/participants/${userParticipant.uid}`));
        }
        
        setCheckingLocation(false);
      },
      (err) => {
        console.error(err);
        setCheckingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    let watchId: number | null = null;

    if (trackingActive && userParticipant?.status === 'joined' && navigator.geolocation) {
      console.log("[ActivityDetail] Starting location tracking");
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          setCurrentUserLocation({ lat: userLat, lng: userLng });
          
          if (userParticipant && id) {
            const now = Date.now();
            if (now - lastUpdateRef.current > 5000) {
              const pRef = doc(db, `activities/${id}/participants`, userParticipant.uid);
              setDoc(pRef, {
                location: { lat: userLat, lng: userLng },
                updatedAt: serverTimestamp()
              }, { merge: true }).catch(err => {
                if (!err.message.includes('No document to update')) {
                  handleFirestoreError(err, OperationType.WRITE, `activities/${id}/participants/${userParticipant.uid}`);
                }
              });
              lastUpdateRef.current = now;
            }
          }

          if (activity) {
            const targetLat = activity.location.lat;
            const targetLng = activity.location.lng;
            const route = await getRouteInfo(userLat, userLng, targetLat, targetLng);
            setDistance(route.distance);
            setDuration(route.duration);

            if (route.distance < 100) {
              handleArrival();
            }
          }
        },
        (err) => console.error("[ActivityDetail] Geolocation error:", err),
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (watchId !== null) {
        console.log("[ActivityDetail] Stopping location tracking");
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [trackingActive, id, userParticipant?.status, !!activity]);

  async function handleJoin() {
    if (!user || !id) return;
    console.log(`[ActivityDetail] Joining activity: ${id}`);
    try {
      const pRef = doc(db, `activities/${id}/participants`, user.uid);
      await setDoc(pRef, {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || '匿名用户',
        photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        status: 'joined',
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert("成功加入活动！");
    } catch (err: any) {
      console.error("[ActivityDetail] handleJoin failed:", err);
      handleFirestoreError(err, OperationType.WRITE, `activities/${id}/participants/${user.uid}`);
    }
  }

  async function handleNoShow() {
    if (!user || !id || !userParticipant || isProcessingAction) return;
    
    if (!confirmingNoShow) {
      setConfirmingNoShow(true);
      setTimeout(() => setConfirmingNoShow(false), 5000);
      return;
    }

    setIsProcessingAction(true);
    console.log(`[ActivityDetail] handleNoShow confirmed for user: ${user.uid}`);
    try {
      const pRef = doc(db, `activities/${id}/participants`, user.uid);
      await setDoc(pRef, { 
        status: 'no-show', 
        updatedAt: serverTimestamp() 
      }, { merge: true });

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { 
        uid: user.uid,
        noShowCount: increment(1), 
        updatedAt: serverTimestamp() 
      }, { merge: true });

      setTrackingActive(false);
      setConfirmingNoShow(false);
      alert('你已标记为放鸽子。行动监控已停止。');
    } catch (err: any) {
      console.error("[ActivityDetail] handleNoShow failed:", err);
      alert(`操作失败: ${err.message || '权限不足或网络异常'}`);
    } finally {
      setIsProcessingAction(false);
    }
  }

  async function handleArrival() {
    if (!user || !id || isProcessingAction) return;
    
    if (!confirmingArrival) {
      setConfirmingArrival(true);
      setTimeout(() => setConfirmingArrival(false), 5000);
      return;
    }

    setIsProcessingAction(true);
    console.log(`[ActivityDetail] handleArrival confirmed for user: ${user.uid}`);
    try {
      const pRef = doc(db, `activities/${id}/participants`, user.uid);
      await setDoc(pRef, { 
        status: 'arrived', 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      setTrackingActive(false);
      setConfirmingArrival(false);
      alert('任务达成！已标记为抵达。行动监控已停止。');
    } catch (err: any) {
      console.error("[ActivityDetail] handleArrival failed:", err);
      alert(`操作失败: ${err.message || '权限不足或网络异常'}`);
    } finally {
      setIsProcessingAction(false);
    }
  }

  async function handleUpdateStatus(newStatus: 'completed' | 'cancelled') {
    if (!id || isProcessingAction) return;

    if (newStatus === 'completed' && !confirmingComplete) {
      setConfirmingComplete(true);
      setTimeout(() => setConfirmingComplete(false), 5000);
      return;
    }

    setIsProcessingAction(true);
    console.log(`[ActivityDetail] handleUpdateStatus initiated: ${newStatus}`);
    try {
      if (newStatus === 'completed') {
        await activityService.completeActivity(id);
      } else {
        await activityService.cancelActivity(id);
      }
      setConfirmingComplete(false);
      alert("活动状态已闭环");
    } catch (err: any) {
      console.error(`[ActivityDetail] handleUpdateStatus failed for ${newStatus}:`, err);
      const msg = err.message?.includes('permission-denied') ? '权限不足，只有发起人或管理员可操作' : (err.message || '操作失败');
      alert(`状态更新失败: ${msg}`);
    } finally {
      setIsProcessingAction(false);
    }
  }

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ 
        title: activity?.title, 
        text: `【行动召集】快加入我的活动：${activity?.title}`, 
        url: url 
      }).catch(() => {
        navigator.clipboard.writeText(url);
        alert('链接已复制到剪贴板！');
      });
    } else {
      navigator.clipboard.writeText(url);
      alert('链接已复制到剪贴板！');
    }
  };

  async function handleActionDelete() {
    if (!id || isDeleting) return;
    
    if (!confirmingArchive) {
      setConfirmingArchive(true);
      setTimeout(() => setConfirmingArchive(false), 5000);
      return;
    }
    
    setIsDeleting(true);
    setConfirmingArchive(false);
    try {
      await activityService.archiveActivity(id);
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error("[ActivityDetail] Archive failed:", err);
      alert(`终止失败: ${err.message || '未知错误'}`);
    } finally {
      setIsDeleting(false);
    }
  };


  if (loading || !activity) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative pb-40 bg-[#050505]">
      {/* Hero Map Background */}
      <div className="h-[45vh] w-full relative z-0">
        <MapContainer 
          center={[activity.location.lat, activity.location.lng]} 
          zoom={15} 
          scrollWheelZoom={true} 
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Destination Marker */}
          <Marker position={[activity.location.lat, activity.location.lng]} icon={destinationIcon} />

          {/* Participant Markers */}
          {participants.filter(p => p.location && p.uid !== user?.uid).map(p => (
            <Marker 
              key={`participant-marker-${p.uid}`} 
              position={[p.location!.lat, p.location!.lng]}
              icon={createParticipantIcon(
                p.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`,
                p.displayName,
                false
              )}
            />
          ))}

          {/* Current User Marker */}
          {currentUserLocation && (
            <Marker 
              key="me-marker" 
              position={[currentUserLocation.lat, currentUserLocation.lng]}
              icon={createParticipantIcon(
                user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'me'}`,
                '我在移动',
                true
              )}
            />
          )}

          <MapControls userLoc={currentUserLocation} destLoc={activity.location} />
        </MapContainer>
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none z-[5]" />
        
        {/* Command Header */}
        <div className="fixed top-8 left-0 right-0 px-6 flex justify-between items-center z-[3000] pointer-events-none">
          <button
            onClick={() => navigate(-1)}
            className="w-12 h-12 bg-black/80 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-2xl active:scale-90 transition-all text-white border border-white/10 pointer-events-auto"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex gap-3 pointer-events-auto">
            <button
              onClick={handleShare}
              className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-2xl active:scale-90 transition-all text-white border border-white/10"
            >
              <Share2 className="w-6 h-6" />
            </button>
            
            {user?.uid === activity.creatorId && (
              <button
                onClick={() => navigate(`/edit/${id}`)}
                className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-2xl active:scale-90 transition-all text-white border border-white/10"
              >
                <Edit3 className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Creator Control Panel (Floating-Bottom Center) */}
        {(user?.uid === activity.creatorId || user?.email === 'choihou95@gmail.com') && (activity.status === 'active' || activity.status === 'completed') && (
          <div className="fixed bottom-40 left-0 right-0 px-6 max-w-lg mx-auto flex justify-center z-[4000]">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 items-center bg-black/40 backdrop-blur-2xl p-4 rounded-3xl border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)]"
            >
              {activity.status === 'active' && (
                <button
                  onClick={() => handleUpdateStatus('completed')}
                  disabled={isProcessingAction}
                  className={cn(
                    "flex items-center gap-3 px-6 py-4 rounded-2xl active:scale-95 transition-all font-black uppercase italic tracking-tighter disabled:opacity-50",
                    confirmingComplete ? "bg-white text-black scale-105" : "bg-green-500 text-black shadow-[0_0_30px_rgba(34,197,94,0.3)]"
                  )}
                >
                  <CheckCircle2 className={cn("w-5 h-5", confirmingComplete && "animate-bounce")} />
                  <span>{confirmingComplete ? '确认完成？' : '任务完成'}</span>
                </button>
              )}

              <button
                onClick={handleActionDelete}
                disabled={isDeleting || isProcessingAction}
                className={cn(
                  "flex items-center gap-3 px-6 py-4 rounded-2xl active:scale-95 transition-all font-black uppercase italic tracking-tighter disabled:opacity-50",
                  confirmingArchive ? "bg-white text-black scale-105" : "bg-[#f43f5e] text-black shadow-[0_0_30px_rgba(244,63,94,0.3)]"
                )}
              >
                {isDeleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Power className={cn("w-5 h-5", confirmingArchive && "animate-bounce")} />
                    <span>{confirmingArchive ? '确认终止？' : '终止行动'}</span>
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </div>

      <div className="px-6 -mt-16 relative z-10">
        <div className="bg-[#0d0d0d] rounded-2xl border border-[#1f1f1f] shadow-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#f43f5e]" />
          
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 bg-[#1a1313] text-[10px] font-bold uppercase rounded border tracking-widest ${
                activity.status === 'active' ? 'text-[#f43f5e] border-[#331c1c]' :
                activity.status === 'completed' ? 'text-green-500 border-green-500/20' :
                'text-gray-500 border-gray-500/20'
              }`}>
                {activity.status === 'active' ? '实战监控中' : 
                 activity.status === 'completed' ? '监控已闭环' : 
                 activity.status === 'cancelled' ? '行动已中止' : '战果已归档'}
              </span>
            </div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter leading-tight mb-2">{activity.title}</h1>
            <p className="text-[#666] text-xs font-medium">{activity.description || '无补充情报'}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-10">
            <div className="flex items-center gap-4 bg-[#111] p-4 rounded-xl border border-[#1f1f1f]">
              <div className="w-10 h-10 bg-[#050505] rounded-lg flex items-center justify-center border border-[#1f1f1f] text-[#f43f5e]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest mb-0.5">预定打击时间</p>
                <p className="font-mono text-sm text-white">
                  {new Date(activity.startTime.toDate()).toLocaleDateString('zh-CN')} · {new Date(activity.startTime.toDate()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-[#111] p-4 rounded-xl border border-[#1f1f1f]">
              <div className="w-10 h-10 bg-[#050505] rounded-lg flex items-center justify-center border border-[#1f1f1f] text-[#f43f5e]">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest mb-0.5">目标经纬地址</p>
                <p className="font-mono text-sm text-white truncate">{activity.location.address}</p>
              </div>
            </div>
          </div>

          {/* Tracking Section */}
          {trackingActive ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-10 p-5 bg-[#1a1313] rounded-2xl border border-[#f43f5e]/30 text-white relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <Navigation className="w-20 h-20 rotate-45" />
              </div>
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#f43f5e] rounded-full animate-ping" />
                  <span className="font-black text-sm uppercase tracking-widest italic text-[#f43f5e]">实时 GPS 链接中</span>
                </div>
                {checkingLocation && <Loader2 className="w-3 h-3 animate-spin text-[#f43f5e]" />}
              </div>
              
              <div className="grid grid-cols-2 gap-6 relative z-10">
                <div>
                  <p className="text-[#666] text-[10px] uppercase font-bold tracking-widest mb-1">距离目的地</p>
                  <p className="text-3xl font-light">{distance !== null ? formatDistance(distance).split(/(?=[a-z])/)[0] : '--'} <span className="text-xs opacity-40 italic">{distance !== null ? formatDistance(distance).match(/[a-z]+/)?.[0] : ''}</span></p>
                </div>
                <div>
                  <p className="text-[#666] text-[10px] uppercase font-bold tracking-widest mb-1">预计耗时</p>
                  <p className="text-3xl font-light">{duration !== null ? formatTime(duration).replace(/[^0-9]/g, '') : '--'} <span className="text-xs opacity-40 italic">{duration !== null ? 'min' : ''}</span></p>
                </div>
              </div>
              
              {userParticipant?.status === 'joined' && (
                <button 
                  onClick={updateLocationInfo}
                  className="w-full mt-6 bg-[#f43f5e]/10 border border-[#f43f5e]/20 text-[#f43f5e] py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#f43f5e]/20 transition-all"
                >
                  刷新位置数据
                </button>
              )}
            </motion.div>
          ) : (
            <div className="mb-10 p-5 bg-[#111] rounded-2xl border border-[#1f1f1f] text-center">
              <div className="flex items-center justify-center gap-2 mb-2 text-[#444]">
                <Clock className="w-4 h-4" />
                <span className="font-black text-[10px] uppercase tracking-widest italic">监控冷却中</span>
              </div>
              <p className="text-[#666] text-[10px] uppercase tracking-[0.1em]">坐标系统将在活动开始前 1 小时自动激活</p>
            </div>
          )}

          {/* Participants */}
          <div className="mb-10">
            <h2 className="text-xs font-black text-[#666] uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
              参与者雷达监控
              <span className="text-[10px] text-[#444] font-normal">{participants.length} 人在册</span>
            </h2>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={`participant-list-${p.uid}`} className="flex items-center justify-between bg-[#111] p-3 rounded-xl border border-[#1f1f1f]">
                  <div className="flex items-center gap-3">
                    <img 
                      src={p.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} 
                      className="w-9 h-9 rounded-full bg-black border border-[#1f1f1f]"
                      alt={p.displayName}
                    />
                    <div>
                      <p className="text-sm font-bold text-white">{p.displayName}</p>
                      <p className={cn(
                        "text-[9px] font-bold uppercase tracking-widest",
                        p.status === 'joined' ? "text-blue-500" : p.status === 'arrived' ? "text-green-500" : "text-[#f43f5e]"
                      )}>
                        {p.status === 'joined' 
                          ? (activity.status === 'archived' ? '未抵达' : '追踪中') 
                          : p.status === 'arrived' 
                            ? '已抵达' 
                            : '鸽了'}
                      </p>
                    </div>
                  </div>
                  
                  {p.location && (
                    <div className="text-right flex flex-col items-end">
                      {(() => {
                        const straightDist = getDistance(p.location!.lat, p.location!.lng, activity.location.lat, activity.location.lng);
                        const roadDist = straightDist * 1.3; // Estimated road distance factor
                        // Vehicle speed 40km/h
                        const mins = Math.round((roadDist / 40) * 60); 
                        return (
                          <>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="w-1 h-1 rounded-full bg-[#f43f5e] animate-pulse" />
                              <span className="font-mono text-white text-xs font-bold">
                                {roadDist < 1 ? `${(roadDist * 1000).toFixed(0)}m` : `${roadDist.toFixed(1)}km`}
                              </span>
                            </div>
                            <span className="text-[8px] text-[#444] uppercase font-black italic tracking-tighter">
                              ETA {mins < 1 ? '<1' : mins} MIN
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FIXED ACTION BUTTONS */}
      <div className="fixed bottom-24 left-0 right-0 px-6 max-w-lg mx-auto z-[5000]">
        {(activity.status === 'active' || activity.status === 'completed') && (
          <>
            {!userParticipant ? (
              activity.status === 'active' && (
                <button
                  onClick={handleJoin}
                  className="w-full bg-[#f43f5e] text-black font-black py-4 rounded-xl shadow-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform uppercase tracking-widest"
                >
                  <PlusCircle className="w-5 h-5" />
                  加入战局
                </button>
              )
            ) : userParticipant.status === 'joined' ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleNoShow}
                  disabled={isProcessingAction}
                  className={cn(
                    "font-black py-4 rounded-xl border flex items-center justify-center gap-2 active:scale-[0.98] transition-all uppercase tracking-widest text-xs disabled:opacity-50",
                    confirmingNoShow ? "bg-white text-black border-white" : "bg-[#1a1313] text-[#f43f5e] border-[#f43f5e]/30"
                  )}
                >
                  {isProcessingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className={cn("w-4 h-4", confirmingNoShow && "animate-bounce")} />}
                  {confirmingNoShow ? '确认鸽了？' : '我鸽了'}
                </button>
                <button
                  onClick={handleArrival}
                  disabled={isProcessingAction}
                  className={cn(
                    "font-black py-4 rounded-xl shadow-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all uppercase tracking-widest text-xs disabled:opacity-50",
                    confirmingArrival ? "bg-green-500 text-black shadow-green-500/20" : "bg-white text-black"
                  )}
                >
                  {isProcessingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className={cn("w-4 h-4", confirmingArrival && "animate-bounce")} />}
                  {confirmingArrival ? '确认抵达？' : '我已抵达'}
                </button>
              </div>
            ) : (
              <div className="w-full bg-[#111] text-[#666] font-black py-4 rounded-xl border border-[#1f1f1f] flex items-center justify-center gap-2 uppercase tracking-widest text-xs shadow-2xl">
                {userParticipant.status === 'arrived' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-green-500/80">你已达成任务</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-[#f43f5e]" />
                    <span className="text-[#f43f5e]/80">你已标记为放鸽子</span>
                  </>
                )}
              </div>
            )}
          </>
        )}
        
        {activity.status !== 'active' && (
          <div className="w-full bg-[#111] text-[#666] font-black py-4 rounded-xl border border-[#1f1f1f] flex items-center justify-center gap-2 uppercase tracking-widest text-xs shadow-2xl">
            <ArchiveIcon className="w-4 h-4" />
            此监控行动已归档
          </div>
        )}
      </div>
    </div>
  );
}

function MapControls({ userLoc, destLoc }: { userLoc: {lat: number, lng: number} | null, destLoc: {lat: number, lng: number} }) {
  const map = useMap();

  const centerOnUser = () => {
    if (map && userLoc) {
      map.flyTo([userLoc.lat, userLoc.lng], 16);
    }
  };

  const centerOnDest = () => {
    if (map) {
      map.flyTo([destLoc.lat, destLoc.lng], 16);
    }
  };

  return (
    <div className="absolute bottom-40 right-4 flex flex-col gap-2 z-[1000]">
      <button
        onClick={centerOnUser}
        disabled={!userLoc}
        className="w-10 h-10 bg-black/80 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/20 text-white shadow-xl active:scale-95 transition-all disabled:opacity-50"
      >
        <Navigation className="w-5 h-5" />
      </button>
      <button
        onClick={centerOnDest}
        className="w-10 h-10 bg-[#f43f5e] rounded-lg flex items-center justify-center text-black shadow-xl active:scale-95 transition-all"
      >
        <MapPin className="w-5 h-5" />
      </button>
    </div>
  );
}
