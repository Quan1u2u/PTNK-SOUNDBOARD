import { useAudioStore, storeActions } from "../lib/store";
import AudioVisualizer from "./AudioVisualizer";
import { Play, Pause, Square, Music, AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";

export default function NowPlaying() {
  const state = useAudioStore();

  // Find active cue details
  const activeCue = state.currentProfile.cues.find((c) => c.id === state.currentCueId);

  // Time format helper
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercentage = state.currentDuration > 0 ? (state.currentTime / state.currentDuration) * 100 : 0;
  const remainingTime = state.currentDuration > 0 ? Math.max(0, state.currentDuration - state.currentTime) : 0;

  // Render standby panel when idle
  const renderStandby = () => {
    return (
      <div className="flex flex-col h-full justify-between p-5 bg-[#111B35]/45 border border-[#1E2E5A] rounded-xl" id="nowplaying-standby">
        {/* Standby Header */}
        <div className="flex flex-col gap-1.5" id="standby-header">
          <span className="text-[10px] font-mono font-bold text-[#00E5FF] uppercase tracking-widest leading-none">SYSTEM STATUS</span>
          <div className="flex items-center gap-2 mt-1" id="standby-status-badge">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
            <span className="text-white font-mono font-bold text-xs">READY FOR PLAYBACK</span>
          </div>
        </div>

        {/* System standby graphic & logs */}
        <div className="my-6 flex flex-col items-center justify-center text-center gap-4 py-8" id="standby-core">
          <div className="relative" id="standby-logo-halo">
            <div className="absolute inset-0 bg-[#00E5FF]/10 blur-xl rounded-full w-20 h-20 -left-4 -top-4 animate-pulse" />
            <div className="w-12 h-12 bg-[#050A18]/90 border border-[#1E2E5A] rounded-xl flex items-center justify-center text-[#00E5FF] font-mono text-sm font-bold shadow-lg" id="standby-logo">
              PTNK
            </div>
          </div>
          <div className="flex flex-col gap-1" id="standby-text">
            <h3 className="text-slate-300 font-bold text-sm tracking-tight">HỆ THỐNG SẴN SÀNG</h3>
            <p className="text-slate-500 text-[11px] max-w-[210px] mx-auto leading-relaxed mt-0.5">
              Chọn bất kỳ một Cue nhạc nền (1-0) hoặc Phím hiệu ứng (F1-F12) để kích hoạt âm thanh sự kiện.
            </p>
          </div>
        </div>

        {/* Standby Live Diagnostics */}
        <div className="border-t border-[#1E2E5A] pt-4 flex flex-col gap-2" id="standby-diagnostics">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500" id="diag-line-1">
            <span>SỰ KIỆN ĐANG CHỌN:</span>
            <span className="text-slate-300 font-bold truncate max-w-[140px]">{state.currentProfile.name}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500" id="diag-line-2">
            <span>MC DUCKING STATUS:</span>
            <span className={state.isDucked ? "text-[#FF3D00] font-bold" : "text-slate-500 font-semibold"}>{state.isDucked ? "ON (DUCKED)" : "STANDBY"}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500" id="diag-line-3">
            <span>CROSSFADE VALUE:</span>
            <span className="text-[#00E5FF] font-semibold">{state.crossfadeTime} giây</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="bg-[#081023] border border-[#1E2E5A] rounded-xl p-5 flex flex-col h-full shadow-lg select-none" id="now-playing-panel">
      <div className="flex items-center justify-between mb-4" id="now-playing-header">
        <h2 className="text-[#00E5FF] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" id="now-playing-section-title">
          <Music className="w-3.5 h-3.5" />
          Giám sát Âm thanh
        </h2>
        {state.currentCueId && (
          state.isPlaying ? (
            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1" id="playing-badge">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              PLAYING
            </span>
          ) : (
            <span className="bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1 animate-pulse" id="paused-badge">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
              PAUSED
            </span>
          )
        )}
      </div>

      {/* Visualizer Area */}
      <div className="h-32 mb-5" id="nowplaying-visualizer-box">
        <AudioVisualizer />
      </div>

      {/* Playback info */}
      <div className="flex-1 flex flex-col justify-between" id="nowplaying-infobox">
        {state.currentCueId && activeCue ? (
          <div className="flex flex-col h-full justify-between" id="nowplaying-active">
            {/* Active track details */}
            <div className="bg-[#111B35]/60 border border-[#1E2E5A] rounded-xl p-4 flex flex-col gap-2" id="active-track-box">
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-[#00E5FF] tracking-wider uppercase leading-none">
                <span>CUE {activeCue.hotkey}</span>
                <span>•</span>
                <span className="text-slate-400 font-semibold truncate max-w-[150px]">{activeCue.isCustom ? "CUSTOM FILE" : "SYNTH PRESET"}</span>
              </div>
              <h3 className="text-white text-base font-bold tracking-tight truncate mt-1 leading-normal" id="active-track-title">
                {activeCue.title}
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mt-0.5" id="active-track-subtitle">
                {activeCue.subtitle}
              </p>
              {activeCue.isCustom && (
                <div className="text-[10px] font-mono text-slate-500 bg-[#050A18]/60 px-2 py-1.5 rounded truncate mt-2 border border-[#1E2E5A]" id="custom-filename">
                  FILE: {activeCue.fileName}
                </div>
              )}
            </div>

            {/* Playback sliders and timers */}
            <div className="mt-4 flex flex-col gap-2.5" id="playback-timer-section">
              {/* Progress bar */}
              <div className="w-full bg-[#050A18] h-2 rounded-full overflow-hidden border border-[#1E2E5A]" id="progress-bar-container">
                <div
                  className="bg-[#00E5FF] h-full rounded-full shadow-[0_0_8px_#00E5FF] transition-all duration-100 ease-linear"
                  style={{ width: `${progressPercentage}%` }}
                  id="progress-bar-fill"
                />
              </div>

              {/* Timers */}
              <div className="flex justify-between items-center font-mono text-xs text-slate-400 px-0.5" id="timers-values">
                <div className="flex flex-col">
                  <span className="text-[8px] font-mono font-bold text-slate-500 uppercase leading-none">ELAPSED</span>
                  <span className="text-slate-300 font-bold mt-1 text-sm">{formatTime(state.currentTime)}</span>
                </div>
                <div className="flex flex-col items-end text-right">
                  <span className="text-[8px] font-mono font-bold text-slate-500 uppercase leading-none">REMAINING</span>
                  <span className="text-[#00E5FF] font-bold mt-1 text-sm">-{formatTime(remainingTime)}</span>
                </div>
              </div>
            </div>

            {/* Side-by-side active controls */}
            <div className="flex gap-2 mt-4" id="nowplaying-quick-controls">
              <button
                onClick={() => storeActions.togglePauseCue()}
                className="flex-1 bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20 border border-[#00E5FF]/20 hover:border-[#00E5FF] py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all"
                id="btn-quick-pause"
              >
                {state.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {state.isPlaying ? "PAUSE" : "RESUME"}
              </button>
              <button
                onClick={() => storeActions.stopCue(activeCue.id)}
                className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-400 p-2.5 rounded-lg flex items-center justify-center transition-all"
                title="Dừng Cue này"
                id="btn-quick-stop"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>
        ) : (
          renderStandby()
        )}
      </div>
    </section>
  );
}
