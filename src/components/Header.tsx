import { useEffect, useState } from "react";
import { useAudioStore, storeActions } from "../lib/store";
import { Sliders, Volume2, Clock, Play, Pause, RotateCcw, AlertTriangle, ShieldCheck, Edit, Zap, LogOut } from "lucide-react";

export default function Header({ onLogout }: { onLogout?: () => void }) {
  const state = useAudioStore();
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  // Stopwatch state for live event stage timing
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // System clock loop
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toTimeString().split(" ")[0]); // HH:MM:SS

      const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      const dayName = days[now.getDay()];
      const dateText = `${dayName}, ${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
      setDateStr(dateText);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Stopwatch ticking loop
  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs > 0 ? hrs.toString().padStart(2, "0") + ":" : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <header className="bg-[#0D152B] border-b border-[#1E2E5A] px-6 py-4 flex items-center justify-between gap-4 select-none" id="ptnk-app-header">
      {/* Brand Branding */}
      <div className="flex items-center gap-4" id="header-brand-section">
        <div className="flex items-center justify-center" id="header-logo">
          <img src="/LOGO.png" alt="PTNK Logo" className="h-20 w-auto object-contain" referrerPolicy="no-referrer" />
        </div>
        <div className="flex flex-col" id="header-titles">
          <span className="text-[#00E5FF] opacity-80 font-mono tracking-widest text-[10px] leading-none font-bold uppercase" id="header-subtitle">
            EVENT PLAYBACK SYSTEM
          </span>
          <h1 className="text-white font-bold text-base uppercase tracking-tight leading-normal mt-1 flex items-center gap-2" id="header-title">
            {state.currentProfile.name}
            <span className="bg-[#00E5FF]/10 text-[#00E5FF] text-[9px] px-1.5 py-0.5 rounded font-mono border border-[#00E5FF]/20 uppercase" id="live-badge">
              LIVE CONSOLE
            </span>
          </h1>
        </div>
      </div>

      {/* Center Section: Stage Timing */}
      <div className="flex items-center gap-4" id="header-center-section">
        {/* Stage Timer / Stop Watch for active timing */}
        <div className="bg-[#111B35]/60 border border-[#1E2E5A] rounded p-2 flex items-center gap-3" id="stage-timer-widget">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase leading-none">STAGE TIMER</span>
            <span className={`font-mono text-base font-bold leading-none mt-1 ${timerSeconds > 0 ? "text-[#FF3D00]" : "text-slate-400"}`} id="timer-display">
              {formatTimer(timerSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTimerRunning(!timerRunning)}
              className={`p-1.5 rounded transition-colors ${timerRunning ? "bg-[#FF3D00]/15 text-[#FF3D00] hover:bg-[#FF3D00]/25" : "bg-[#00E5FF]/15 text-[#00E5FF] hover:bg-[#00E5FF]/25"}`}
              title={timerRunning ? "Tạm dừng đếm" : "Bắt đầu đếm"}
              id="btn-timer-toggle"
            >
              {timerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
            </button>
            <button
              onClick={() => {
                setTimerRunning(false);
                setTimerSeconds(0);
              }}
              className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-[#1A284A] transition-colors"
              title="Đặt lại"
              id="btn-timer-reset"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Section: Master Clock and Volume */}
      <div className="flex items-center gap-6" id="header-right-section">
        {/* Real-time precision clock */}
        <div className="flex flex-col items-end text-right select-none" id="header-clock-widget">
          <div className="flex items-center gap-1.5 text-[#00E5FF]" id="header-clock-inner">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span className="font-mono text-lg font-bold tracking-widest text-[#00E5FF] leading-none" id="clock-display">
              {timeStr}
            </span>
          </div>
          <span className="text-[11px] whitespace-nowrap font-mono text-slate-500 uppercase mt-1 leading-none tracking-wider" id="date-display">
            {dateStr}
          </span>
        </div>

        {/* Master volume control bar */}
        <div className="flex items-center gap-2 bg-[#111B35] border border-[#1E2E5A] rounded-lg px-4 py-2" id="header-volume-control">
          <Volume2 className="w-4 h-4 text-slate-400" />
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center w-36">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase leading-none">MASTER VOLUME</span>
              <span className="text-[10px] font-mono font-bold text-[#00E5FF] leading-none">{Math.round(state.masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={state.masterVolume}
              onChange={(e) => storeActions.setMasterVolume(parseFloat(e.target.value))}
              className="w-36 h-1 bg-[#050A18] rounded-lg appearance-none cursor-pointer accent-[#00E5FF] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]"
              id="master-volume-slider"
            />
          </div>
        </div>

        {/* Console mode toggle and tools */}
        <div className="flex items-center gap-1 bg-[#0D152B] border border-[#1E2E5A] rounded-lg p-1" id="mode-toggles-container">
          <button
            onClick={() => storeActions.setEditMode(false)}
            className={`px-3 py-1.5 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-all ${
              !state.isEditMode ? "bg-[#00E5FF]/20 text-[#00E5FF] shadow-sm border border-[#00E5FF]/30" : "text-slate-400 hover:text-slate-200"
            }`}
            id="btn-mode-live"
          >
            <Zap className="w-3.5 h-3.5" />
            LIVE MODE
          </button>
          <button
            onClick={() => storeActions.setEditMode(true)}
            className={`px-3 py-1.5 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-all ${
              state.isEditMode ? "bg-[#FF3D00]/20 text-[#FF3D00] shadow-sm border border-[#FF3D00]/30" : "text-slate-400 hover:text-slate-200"
            }`}
            id="btn-mode-edit"
          >
            <Edit className="w-3.5 h-3.5" />
            CONFIG CUES
          </button>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
            id="btn-logout"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-3.5 h-3.5" />
            ĐĂNG XUẤT
          </button>
        )}
      </div>
    </header>
  );
}
