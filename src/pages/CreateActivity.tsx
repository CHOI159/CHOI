import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, Timestamp, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { MapPin, Calendar, Clock, Loader2, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LocationSearch } from '../components/LocationSearch';

// Fix Leaflet icon issue
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapSync({ marker, onMapClick }: { marker: { lat: number, lng: number } | null, onMapClick: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (marker) {
      map.setView([marker.lat, marker.lng], map.getZoom());
    }
  }, [marker, map]);

  return marker ? <Marker position={[marker.lat, marker.lng]} /> : null;
}

export function CreateActivity() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !location) return;

    setLoading(true);
    setError('');

    try {
      const startTime = new Date(`${date}T${time}`);
      
      const generateShareCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };
      
      let docId = '';
      try {
        const shareCode = generateShareCode();
        const docRef = await addDoc(collection(db, 'activities'), {
          title,
          description,
          startTime: Timestamp.fromDate(startTime),
          location,
          creatorId: user.uid,
          creatorName: profile?.displayName || user.displayName || '匿名',
          status: 'active',
          createdAt: serverTimestamp(),
          shareCode,
          participantIds: [user.uid]
        });
        docId = docRef.id;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'activities');
      }

      // Add creator as first participant
      try {
        const pRef = doc(db, `activities/${docId}/participants`, user.uid);
        await setDoc(pRef, {
          uid: user.uid,
          displayName: profile?.displayName || user.displayName || '匿名',
          photoURL: user.photoURL || '',
          status: 'joined',
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `activities/${docId}/participants/${user.uid}`);
      }

      navigate(`/activity/${docId}`);
    } catch (err) {
      console.error(err);
      setError('创建活动失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 pt-10">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">发起活动</h1>
        <p className="text-[#888] text-xs uppercase tracking-widest mt-1">设置时间地点，捉鸽网已张开。</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-[#666] uppercase tracking-widest mb-2 ml-1">活动名称</label>
            <input
              required
              type="text"
              placeholder="e.g. 今晚海底捞聚餐"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#0d0d0d] border border-[#1f1f1f] text-white rounded-xl px-4 py-4 focus:ring-1 focus:ring-[#f43f5e] outline-none transition-all placeholder:text-[#333] font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-[#666] uppercase tracking-widest mb-2 ml-1">日期</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444] pointer-events-none" />
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-[#1f1f1f] text-white rounded-xl pl-12 pr-4 py-4 focus:ring-1 focus:ring-[#f43f5e] outline-none transition-all flex h-[58px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#666] uppercase tracking-widest mb-2 ml-1">时间</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444] pointer-events-none" />
                <input
                  required
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-[#1f1f1f] text-white rounded-xl pl-12 pr-4 py-4 focus:ring-1 focus:ring-[#f43f5e] outline-none transition-all flex h-[58px]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#666] uppercase tracking-widest mb-2 ml-1">目的地监控点 (可搜索或点击地图)</label>
            <div className="rounded-2xl overflow-hidden border border-[#1f1f1f] shadow-2xl relative">
              <div className="p-3 bg-[#0d0d0d] border-b border-[#1f1f1f]">
                <LocationSearch onLocationSelect={(p) => setLocation(p)} />
              </div>
              <div className="h-64 relative bg-[#0d0d0d] z-0">
                <MapContainer 
                  center={[31.2304, 121.4737]} 
                  zoom={13} 
                  scrollWheelZoom={true} 
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  <MapSync 
                    marker={location} 
                    onMapClick={(lat, lng) => setLocation({ lat, lng, address: `监测中: ${lat.toFixed(4)}, ${lng.toFixed(4)}` })} 
                  />
                </MapContainer>
              </div>
            </div>
            {location && (
              <p className="mt-3 text-[10px] text-[#f43f5e] font-bold uppercase tracking-widest flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                目标锁定：{location.address}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#666] uppercase tracking-widest mb-2 ml-1">策略补充 (可选)</label>
            <textarea
              rows={3}
              placeholder="放鸽子者必受众嘲..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0d0d0d] border border-[#1f1f1f] text-white rounded-xl px-4 py-4 focus:ring-1 focus:ring-[#f43f5e] outline-none transition-all placeholder:text-[#333] resize-none"
            />
          </div>
        </div>

        {error && <p className="text-[#f43f5e] text-[10px] text-center font-bold uppercase tracking-widest bg-[#1a1313] py-3 rounded-xl border border-[#331c1c]">{error}</p>}

        <button
          disabled={loading || !location}
          className="w-full bg-white text-black font-black py-5 rounded-xl shadow-2xl active:scale-[0.98] disabled:opacity-30 disabled:active:scale-100 transition-all flex items-center justify-center uppercase tracking-widest"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '立即开启追踪'}
        </button>
      </form>
    </div>
  );
}
