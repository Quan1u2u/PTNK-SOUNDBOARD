import { useEffect, useState } from "react";
import { useAudioStore, storeActions, initializeStore } from "./lib/store";
import Header from "./components/Header";
import NowPlaying from "./components/NowPlaying";
import CueGrid from "./components/CueGrid";
import SfxGrid from "./components/SfxGrid";
import ControlBar from "./components/ControlBar";
import Login from "./components/Login";
import { Activity, ShieldCheck, Zap, Layers, HelpCircle, X } from "lucide-react";

export default function App() {
  const state = useAudioStore();
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootStatus, setBootStatus] = useState("Kích hoạt Web Audio Context...");
  const [showHelp, setShowHelp] = useState(false);
  
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("ptnk_logged_in") === "true";
  });

  const handleLoginSuccess = () => {
    localStorage.setItem("ptnk_logged_in", "true");
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("ptnk_logged_in");
    setIsLoggedIn(false);
    storeActions.stopAll();
  };

  // 1. Initialise database and audio engines with a neat visual booting loader
  useEffect(() => {
    const bootSequence = async () => {
      try {
        setBootProgress(15);
        setBootStatus("Đang kiểm tra kết nối CSDL IndexedDB...");
        await new Promise((r) => setTimeout(r, 250));

        setBootProgress(40);
        setBootStatus("Tải danh sách kịch bản lễ hội PTNK...");
        await initializeStore();
        await new Promise((r) => setTimeout(r, 300));

        setBootProgress(70);
        setBootStatus("Đang nạp bộ dịch mã procedural âm thanh...");
        await new Promise((r) => setTimeout(r, 200));

        setBootProgress(90);
        setBootStatus("Tải trước nhạc và hiệu ứng tự chọn...");
        await new Promise((r) => setTimeout(r, 200));

        setBootProgress(100);
        setIsBooting(false);
      } catch (e) {
        console.error("Boot error:", e);
        setBootStatus("Lỗi khởi tạo. Vui lòng làm mới trang.");
      }
    };
    bootSequence();
  }, []);

  // 2. Global Keyboard Shortcuts Listener
  useEffect(() => {
    if (isBooting || !isLoggedIn) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if user is typing in form inputs/textareas
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      const key = e.key;

      // Escape -> Stop All (Emergency Panic Button)
      if (key === "Escape") {
        e.preventDefault();
        storeActions.stopAll();
        return;
      }

      // Space -> Pause/Resume current cue
      if (key === " ") {
        e.preventDefault();
        storeActions.togglePauseCue();
        return;
      }

      // ArrowUp -> Increase Volume
      if (key === "ArrowUp") {
        e.preventDefault();
        const nextVolume = Math.min(5.0, state.masterVolume + 0.05);
        storeActions.setMasterVolume(Math.round(nextVolume * 100) / 100);
        return;
      }

      // ArrowDown -> Decrease Volume
      if (key === "ArrowDown") {
        e.preventDefault();
        const nextVolume = Math.max(0.0, state.masterVolume - 0.05);
        storeActions.setMasterVolume(Math.round(nextVolume * 100) / 100);
        return;
      }

      // 'd' or 'D' -> MC Ducking Toggle
      if (key.toLowerCase() === "d") {
        e.preventDefault();
        storeActions.toggleDucking();
        return;
      }

      // Ctrl + Z -> Undo Action
      if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "z") {
        e.preventDefault();
        storeActions.undo();
        return;
      }

      // 1-0 Keys -> Play Event Cues (1 to 10)
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        const index = key === "0" ? 9 : parseInt(key) - 1;
        const targetCue = state.currentProfile.cues[index];
        if (targetCue) {
          storeActions.playCue(targetCue);
        }
        return;
      }

      // Q-P Keys -> Play Event Cues (11 to 20)
      const qweKeys = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
      const qweIndex = qweKeys.indexOf(key.toLowerCase());
      if (qweIndex !== -1) {
        e.preventDefault();
        const index = 10 + qweIndex;
        const targetCue = state.currentProfile.cues[index];
        if (targetCue) {
          storeActions.playCue(targetCue);
        }
        return;
      }

      // Z-S Keys -> Play Sound Effects (SFX 1 to 12: Z, X, C, V, B, N, M, ,, ., /, A, S)
      const sfxKeys = ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/", "a", "s"];
      const sfxIndex = sfxKeys.indexOf(key.toLowerCase());
      if (sfxIndex !== -1) {
        e.preventDefault();
        const targetSfx = state.currentProfile.sfxs[sfxIndex];
        if (targetSfx) {
          storeActions.playSfx(targetSfx);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBooting, isLoggedIn, state.currentProfile, state.masterVolume]);

  // Loading screen render
  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-[#050A18] flex flex-col items-center justify-center select-none" id="boot-screen">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-radial-gradient from-[#0D152B]/20 via-transparent to-transparent opacity-60" />

        <div className="relative flex flex-col items-center max-w-sm w-full text-center px-6 z-10" id="boot-core">
          {/* Logo badge */}
          <div className="w-16 h-16 bg-[#00E5FF] text-[#050A18] rounded-md flex items-center justify-center font-black text-2xl tracking-tighter uppercase italic mb-6 shadow-[0_0_20px_rgba(0,229,255,0.4)]" id="boot-logo">
            PTNK
          </div>

          {/* Heading */}
          <h1 className="text-white font-black text-xl tracking-wider leading-none uppercase" id="boot-title">
            PTNK PLAYBACK SYSTEM
          </h1>
          <span className="text-[#00E5FF] font-mono text-[9px] tracking-widest uppercase mt-2 leading-none font-bold">
            TRƯỜNG PHỔ THÔNG NĂNG KHIẾU, ĐHQG-HCM
          </span>

          {/* Loader bar */}
          <div className="w-full bg-[#111B35] h-1.5 rounded-full mt-10 overflow-hidden border border-[#1E2E5A]" id="boot-loader-track">
            <div
              className="bg-[#00E5FF] h-full rounded-full transition-all duration-300 shadow-[0_0_10px_#00E5FF]"
              style={{ width: `${bootProgress}%` }}
              id="boot-loader-fill"
            />
          </div>

          {/* Progress text */}
          <span className="text-[10px] font-mono text-slate-500 uppercase mt-3 tracking-wide" id="boot-status-text">
            {bootStatus}
          </span>
        </div>
      </div>
    );
  }

  // Login screen render
  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#050A18] text-white flex flex-col font-sans selection:bg-[#00E5FF]/30 selection:text-[#00E5FF]" id="app-viewport">
      {/* 1. Header Row */}
      <Header onLogout={handleLogout} />

      {/* 2. Main Live Interface */}
      <main className="flex-1 p-6 grid grid-cols-12 gap-5 overflow-hidden" id="app-main-layout">
        {/* LEFT COLUMN: Monitoring and Now Playing */}
        <div className="col-span-12 lg:col-span-3 flex flex-col h-full" id="left-column">
          <NowPlaying />
        </div>

        {/* CENTER COLUMN: 10 Cue buttons Grid */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-5 h-full" id="center-column">
          <div className="flex-1 bg-[#050A18] border border-[#1E2E5A] p-5 rounded-xl flex flex-col" id="center-column-inner">
            <CueGrid />
          </div>
        </div>

        {/* RIGHT COLUMN: 12 Sound effects Cards */}
        <div className="col-span-12 lg:col-span-3 flex flex-col h-full" id="right-column">
          <SfxGrid />
        </div>
      </main>

      {/* 3. Bottom Control Row */}
      <ControlBar />

      {/* 4. Float Info Shortcut Button */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-20 right-6 bg-slate-950 hover:bg-slate-900 border border-cyan-950 text-cyan-400 hover:text-cyan-300 p-3 rounded-full shadow-lg cursor-pointer transition-all flex items-center justify-center z-50 hover:scale-105"
        title="Hướng dẫn phím tắt"
        id="btn-shortcut-help"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* Help Modal Overlay */}
      {showHelp && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 z-50" id="help-overlay">
          <div className="bg-slate-900 border border-cyan-500/20 max-w-lg w-full rounded-2xl p-6 relative shadow-2xl" id="help-modal">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              id="btn-close-help"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-white font-bold text-lg tracking-tight mb-1">
              BẢNG HƯỚNG DẪN VẬN HÀNH NHANH
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-5">
              Hệ thống được tối ưu hóa cho tốc độ xử lý một chạm bằng Bàn phím máy tính trong các sự kiện trực tiếp tại Trường Phổ thông Năng khiếu.
            </p>

            <div className="flex flex-col gap-3.5" id="help-shortcuts-list">
              <div className="flex justify-between items-center border-b border-cyan-950/40 pb-2 text-xs" id="shortcut-row-1">
                <span className="text-slate-300 font-semibold">Kích hoạt Cues nhạc nền</span>
                <span className="font-mono bg-cyan-500/15 text-cyan-400 px-2 py-1 rounded border border-cyan-500/20 font-bold">Phím 1–0 & Q–P</span>
              </div>
              <div className="flex justify-between items-center border-b border-cyan-950/40 pb-2 text-xs" id="shortcut-row-2">
                <span className="text-slate-300 font-semibold">Phát hiệu ứng âm thanh phụ (SFX)</span>
                <span className="font-mono bg-cyan-500/15 text-cyan-400 px-2 py-1 rounded border border-cyan-500/20 font-bold">Phím Z–M, Comma, Dot, Slash, A, S</span>
              </div>
              <div className="flex justify-between items-center border-b border-cyan-950/40 pb-2 text-xs" id="shortcut-row-3">
                <span className="text-slate-300 font-semibold">Bật/Tắt MC Ducking (Dìm nhạc nền)</span>
                <span className="font-mono bg-amber-500/15 text-amber-400 px-2 py-1 rounded border border-amber-500/20 font-bold">Phím D</span>
              </div>
              <div className="flex justify-between items-center border-b border-cyan-950/40 pb-2 text-xs" id="shortcut-row-4">
                <span className="text-slate-300 font-semibold">Tạm dừng / Tiếp tục nhạc nền</span>
                <span className="font-mono bg-slate-950 text-slate-300 px-2.5 py-1 rounded border border-cyan-950/40 font-bold">Phím SPACE (Cách)</span>
              </div>
              <div className="flex justify-between items-center border-b border-cyan-950/40 pb-2 text-xs" id="shortcut-row-5">
                <span className="text-slate-300 font-semibold">DỪNG TOÀN BỘ ÂM THANH KHẨN CẤP</span>
                <span className="font-mono bg-rose-500/20 text-rose-400 px-2 py-1 rounded border border-rose-500/30 font-bold">Phím ESC</span>
              </div>
              <div className="flex justify-between items-center border-b border-cyan-950/40 pb-2 text-xs" id="shortcut-row-6">
                <span className="text-slate-300 font-semibold">Hoàn tác dừng nhạc / đổi nhạc</span>
                <span className="font-mono bg-slate-950 text-slate-300 px-2 py-1 rounded border border-cyan-500/20 font-bold">Ctrl + Z</span>
              </div>
              <div className="flex justify-between items-center border-b border-cyan-950/40 pb-2 text-xs" id="shortcut-row-vol">
                <span className="text-slate-300 font-semibold">Tăng / Giảm Âm lượng Tổng (Master)</span>
                <span className="font-mono bg-[#00E5FF]/10 text-[#00E5FF] px-2 py-1 rounded border border-[#00E5FF]/20 font-bold">Phím Lên / Xuống (↑/↓)</span>
              </div>
              <div className="flex justify-between items-center pb-2 text-xs" id="shortcut-row-7">
                <span className="text-slate-300 font-semibold">Bật / Tắt Fullscreen Console</span>
                <span className="font-mono bg-slate-950 text-slate-300 px-2 py-1 rounded border border-cyan-950/40 font-bold">Phím F11</span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-cyan-950/40 flex items-center gap-2 text-[11px] text-slate-500 leading-relaxed" id="help-footer">
              <ShieldCheck className="w-4.5 h-4.5 text-cyan-500 shrink-0" />
              <span>Chế độ <strong>CONFIG CUES</strong> ở góc phải trên cho phép bạn tự sửa nhãn sự kiện và kéo-thả nhạc MP3 của ban tổ chức vào từng phím cực kỳ nhanh chóng.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
