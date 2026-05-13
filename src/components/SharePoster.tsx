import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Activity } from '../types';
import { X, Download, Copy, Loader2, MapPin, Calendar, Clock } from 'lucide-react';

interface SharePosterProps {
  activity: Activity;
  isOpen: boolean;
  onClose: () => void;
}

export function SharePoster({ activity, isOpen, onClose }: SharePosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const shareUrl = window.location.href;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('链接已复制，快去邀请朋友吧！');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('链接复制失败');
    }
  };

  const handleDownloadPoster = async () => {
    if (!posterRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#050505',
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `咕咕雷达-${activity.title}.png`;
      link.click();
    } catch (err) {
      console.error('Failed to generate poster: ', err);
      alert('海报生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[6000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      >
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="self-end mb-4 bg-white/10 p-2 rounded-full text-white hover:bg-white/20 active:scale-90 transition-all font-bold"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Poster Element */}
          <div
            ref={posterRef}
            className="w-full bg-[#0d0d0d] rounded-[32px] border border-[#1f1f1f] shadow-2xl overflow-hidden relative"
          >
            {/* Visual Accent */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-[#f43f5e]" />
            
            <div className="p-8">
              <div className="mb-8">
                <span className="px-3 py-1 bg-white/5 text-[#f43f5e] text-xs font-black uppercase tracking-widest rounded-full border border-white/10 mb-4 inline-block">
                  咕咕雷达 抓鸽行动
                </span>
                <h2 className="text-3xl font-black text-white tracking-tight leading-tight mb-2">
                  {activity.title}
                </h2>
                <p className="text-[#666] text-sm uppercase tracking-widest font-bold">
                  由 {activity.creatorName} 发起
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-zinc-300 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-medium">
                    {new Date(activity.startTime.toDate()).toLocaleDateString('zh-CN', {
                      month: 'long', day: 'numeric', weekday: 'long'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-zinc-300 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <Clock className="w-5 h-5 text-[#f43f5e]" />
                  <span className="text-sm font-medium font-mono">
                    {new Date(activity.startTime.toDate()).toLocaleTimeString('zh-CN', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-zinc-300 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <MapPin className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                  <span className="text-sm font-medium leading-relaxed">
                    {activity.location.address}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center bg-black/50 p-6 rounded-3xl border border-white/5">
                <div className="p-2 bg-white rounded-2xl mb-4">
                  <QRCodeSVG 
                    value={shareUrl} 
                    size={120} 
                    bgColor={"#ffffff"} 
                    fgColor={"#000000"} 
                    level={"Q"} 
                  />
                </div>
                <p className="text-xs text-[#888] tracking-widest uppercase font-bold text-center">
                  长按扫码加入活动<br />开启实时防鸽监控
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4 w-full">
            <button
              onClick={handleCopyLink}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-sm uppercase tracking-widest border border-white/10"
            >
              <Copy className="w-5 h-5" />
              复制链接
            </button>
            <button
              onClick={handleDownloadPoster}
              disabled={isGenerating}
              className="flex-1 bg-[#f43f5e] hover:bg-rose-600 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-rose-900/20 text-sm uppercase tracking-widest"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              保存海报
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
