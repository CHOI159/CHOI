import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Navigation } from './components/Navigation';
import { Home } from './pages/Home';
import { CreateActivity } from './pages/CreateActivity';
import { EditActivity } from './pages/EditActivity';
import { ActivityDetail } from './pages/ActivityDetail';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';
import { Archive } from './pages/Archive';
import { LogIn, AlertTriangle, ExternalLink } from 'lucide-react';
import { isFirebaseConfigured } from './lib/firebase';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn } = useAuth();

  if (!isFirebaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-[#050505]">
        <div className="w-16 h-16 bg-[#1a1313] border border-[#f43f5e]/30 rounded-2xl flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-[#f43f5e]" />
        </div>
        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-4">需要配置 Firebase</h2>
        <p className="text-[#666] text-sm mb-8 leading-relaxed">
          自动设置遇到权限问题。请在 <span className="text-[#f43f5e] font-bold">Secrets</span> 面板中添加 Firebase 配置项（如 VITE_FIREBASE_API_KEY 等）以启用雷达监控系统。
        </p>
        <a 
          href="https://console.firebase.google.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-white transition-colors border border-[#1f1f1f] px-4 py-2 rounded-lg"
        >
          前往 Firebase 控制台 <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f43f5e]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-[#050505]">
        <div className="w-20 h-20 bg-[#f43f5e] rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-rose-900/20">
          <span className="text-black font-black text-3xl italic">G</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">鸽子雷达 <span className="text-[#f43f5e]">FlakeRadar</span></h1>
        <p className="text-[#888] mb-12 max-w-xs text-sm uppercase tracking-widest">
          实时监控，让每一只“鸽神”都无所遁形
        </p>
        <button
          onClick={() => signIn()}
          className="w-full max-w-xs bg-white text-black font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-tighter"
        >
          使用 Google 登录
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-[#050505] pb-24 text-[#e0e0e0]">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><CreateActivity /></ProtectedRoute>} />
            <Route path="/edit/:id" element={<ProtectedRoute><EditActivity /></ProtectedRoute>} />
            <Route path="/activity/:id" element={<ProtectedRoute><ActivityDetail /></ProtectedRoute>} />
            <Route path="/archive" element={<ProtectedRoute><Archive /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <NavigationStateWrapper />
        </div>
      </AuthProvider>
    </Router>
  );
}

function NavigationStateWrapper() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigation />;
}
