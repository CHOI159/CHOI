import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { MapPin, Calendar, Clock, Loader2, ArrowLeft } from 'lucide-react';
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

export function EditActivity() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);

  useEffect(() => {
    async function loadActivity() {
      if (!id || !user) return;
      try {
        const docRef = doc(db, 'activities', id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.creatorId !== user.uid) {
            navigate('/');
            return;
          }
          setTitle(data.title);
          setDescription(data.description || '');
          const startDate = data.startTime.toDate();
          setDate(startDate.toISOString().split('T')[0]);
          setTime(startDate.toTimeString().split(' ')[0].substring(0, 5));
          setLocation(data.location);
        } else {
          navigate('/');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `activities/${id}`);
        setError('加载活动失败');
      } finally {
        setLoading(false);
      }
    }
    loadActivity();
  }, [id, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user || !location) return;

    setSaving(true);
    setError('');

    try {
      const startTime = new Date(`${date}T${time}`);
      
      await updateDoc(doc(db, 'activities', id), {
        title,
        description,
        startTime: Timestamp.fromDate(startTime),
        location,
        updatedAt: serverTimestamp(),
      });

      navigate(`/activity/${id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `activities/${id}`);
      setError('更新活动失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#f43f5e]" />
      </div>
    );
  }

  return (
    <div className="p-6 pt-10">
      <header className="mb-10 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-[#0d0d0d] border border-[#1f1f1f] rounded-lg flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">修改任务</h1>
          <p className="text-[#888] text-xs uppercase tracking-widest mt-1">情报有误？立即修正坐标。</p>
        </div>
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
                  center={location ? [location.lat, location.lng] : [31.2304, 121.4737]} 
                  zoom={13} 
                  scrollWheelZoom={true} 
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
              placeholder="情报修正..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0d0d0d] border border-[#1f1f1f] text-white rounded-xl px-4 py-4 focus:ring-1 focus:ring-[#f43f5e] outline-none transition-all placeholder:text-[#333] resize-none"
            />
          </div>
        </div>

        {error && <p className="text-[#f43f5e] text-[10px] text-center font-bold uppercase tracking-widest bg-[#1a1313] py-3 rounded-xl border border-[#331c1c]">{error}</p>}

        <button
          disabled={saving || !location}
          className="w-full bg-white text-black font-black py-5 rounded-xl shadow-2xl active:scale-[0.98] disabled:opacity-30 disabled:active:scale-100 transition-all flex items-center justify-center uppercase tracking-widest"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : '保存修正的情报'}
        </button>
      </form>
    </div>
  );
}
