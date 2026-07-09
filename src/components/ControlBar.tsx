import React, { useRef } from "react";
import { useAudioStore, storeActions } from "../lib/store";
import { Play, Pause, Square, Sliders, RefreshCw, Download, Upload, Maximize2, Undo2, Mic } from "lucide-react";

export default function ControlBar() {
  const state = useAudioStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const confirmImport = window.confirm("Bắt đầu tải nhập cấu hình sự kiện mới? Thao tác này sẽ tạo một Kịch bản sự kiện riêng trong danh sách.");
      if (confirmImport) {
        await storeActions.importEventBackupBundle(file);
      }
    }
  };

  const handleResetProfile = () => {
    const confirmReset = window.confirm(
      "Bạn chắc chắn muốn Đặt lại Kịch bản này về mặc định? Toàn bộ file nhạc tự tải lên và tiêu đề tự sửa của Sự kiện hiện tại sẽ bị xóa sạch."
    );
    if (confirmReset) {
      storeActions.resetActiveProfileToDefaults();
    }
  };

  return (
    <footer className="bg-[#0D152B] border-t border-[#1E2E5A] p-4 flex flex-col md:flex-row items-center justify-between gap-4 select-none" id="ptnk-app-controlbar">
      {/* Playback Settings Group (Left) */}
      <div className="flex flex-wrap items-center gap-4.5" id="controlbar-settings-group">
        {/* Crossfade */}
        <div className="flex flex-col gap-1" id="ctrl-crossfade">
          <div className="flex justify-between items-center w-36 text-[10px] font-mono font-bold text-slate-500 uppercase leading-none">
            <span>Crossfade</span>
            <span className="text-[#00E5FF] font-bold">{state.crossfadeTime}s</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={state.crossfadeTime}
            onChange={(e) => storeActions.setCrossfadeTime(parseFloat(e.target.value))}
            className="w-36 h-1 bg-[#050A18] rounded appearance-none cursor-pointer accent-[#00E5FF]"
            title="Độ mượt khi chuyển giao giữa 2 bản nhạc nền"
            id="slider-crossfade"
          />
        </div>

        {/* Fade In */}
        <div className="flex flex-col gap-1" id="ctrl-fadein">
          <div className="flex justify-between items-center w-36 text-[10px] font-mono font-bold text-slate-500 uppercase leading-none">
            <span>Fade In Time</span>
            <span className="text-[#00E5FF] font-bold">{state.fadeInTime}s</span>
          </div>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={state.fadeInTime}
            onChange={(e) => storeActions.setFadeInTime(parseFloat(e.target.value))}
            className="w-36 h-1 bg-[#050A18] rounded appearance-none cursor-pointer accent-[#00E5FF]"
            id="slider-fadein"
          />
        </div>

        {/* Fade Out */}
        <div className="flex flex-col gap-1" id="ctrl-fadeout">
          <div className="flex justify-between items-center w-36 text-[10px] font-mono font-bold text-slate-500 uppercase leading-none">
            <span>Fade Out Time</span>
            <span className="text-[#00E5FF] font-bold">{state.fadeOutTime}s</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={state.fadeOutTime}
            onChange={(e) => storeActions.setFadeOutTime(parseFloat(e.target.value))}
            className="w-36 h-1 bg-[#050A18] rounded appearance-none cursor-pointer accent-[#00E5FF]"
            id="slider-fadeout"
          />
        </div>
      </div>

      {/* Main Core Triggers (Center) */}
      <div className="flex items-center gap-3" id="controlbar-core-triggers">
        {/* MC Ducking */}
        <button
          onClick={() => storeActions.toggleDucking()}
          className={`px-4.5 py-2 rounded-xl flex items-center gap-2 text-xs font-bold font-mono transition-all border ${
            state.isDucked
              ? "bg-[#FF3D00]/20 hover:bg-[#FF3D00]/30 text-[#FF3D00] border-[#FF3D00]/40 shadow-[0_0_10px_rgba(255,61,0,0.15)] animate-pulse"
              : "bg-[#0D152B] hover:bg-[#111B35] text-slate-400 border-[#1E2E5A]"
          }`}
          title="Dìm nhạc nền xuống 10% khi MC nói (Phím tắt: D)"
          id="btn-ducking-toggle"
        >
          <Mic className={`w-4 h-4 ${state.isDucked ? "text-[#FF3D00]" : "text-slate-500"}`} />
          MC DUCKING [D]
        </button>

        {/* Pause Cue */}
        <button
          onClick={() => storeActions.togglePauseCue()}
          className="px-5 py-2.5 bg-[#0D152B] hover:bg-[#111B35] text-white rounded-xl text-xs font-bold font-mono border border-[#1E2E5A] flex items-center gap-2 transition-all"
          title="Tạm dừng / Tiếp tục nhạc nền đang phát (Phím tắt: Space)"
          id="btn-play-pause-toggle"
        >
          {state.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current text-[#00E5FF]" />}
          PAUSE / RESUME [Space]
        </button>

        {/* Stop All (Panic Button) */}
        <button
          onClick={() => storeActions.stopAll()}
          className="px-6 py-2.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-400 rounded-xl text-xs font-extrabold font-mono flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(244,63,94,0.1)]"
          title="DỪNG KHẨN CẤP TOÀN BỘ ÂM THANH (Phím tắt: ESC)"
          id="btn-stop-all"
        >
          <Square className="w-4 h-4 fill-current animate-pulse" />
          STOP ALL SOUNDS [ESC]
        </button>

        {/* Undo Action */}
        <button
          onClick={() => storeActions.undo()}
          className="p-2.5 bg-[#0D152B] hover:bg-[#111B35] text-slate-400 hover:text-slate-200 border border-[#1E2E5A] rounded-xl transition-all"
          title="Hoàn tác hành động đổi nhạc hoặc dừng đột ngột (Phím tắt: Ctrl+Z)"
          id="btn-undo-action"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-2.5 bg-[#0D152B] hover:bg-[#111B35] text-slate-400 hover:text-slate-200 border border-[#1E2E5A] rounded-xl transition-all"
          title="Phóng to toàn màn hình Console (Phím tắt: F11)"
          id="btn-fullscreen-toggle"
        >
          <Maximize2 className="w-4 h-4 text-[#00E5FF]" />
        </button>
      </div>

      {/* Backup and Administration (Right) */}
      <div className="flex items-center gap-2" id="controlbar-admin-group">
        {/* Reset Profile */}
        <button
          onClick={handleResetProfile}
          className="p-2 bg-[#0D152B] hover:bg-[#111B35] text-slate-500 hover:text-slate-300 rounded-lg border border-[#1E2E5A] transition-all text-xs"
          title="Đặt lại kịch bản sự kiện này về ban đầu"
          id="btn-reset-profile"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Export Profile backup package */}
        <button
          onClick={() => storeActions.exportEventBackupBundle()}
          className="px-3.5 py-2 bg-[#0D152B] hover:bg-[#111B35] text-slate-300 hover:text-white rounded-lg border border-[#1E2E5A] text-xs font-medium font-mono flex items-center gap-1.5 transition-all"
          title="Xuất gói cấu hình âm thanh dự phòng kèm file audio tải lên"
          id="btn-export-backup"
        >
          <Download className="w-3.5 h-3.5 text-[#00E5FF]" />
          BACKUP PACKAGE
        </button>

        {/* Import backup bundle */}
        <button
          onClick={handleImportClick}
          className="px-3.5 py-2 bg-[#0D152B] hover:bg-[#111B35] text-slate-300 hover:text-white rounded-lg border border-[#1E2E5A] text-xs font-medium font-mono flex items-center gap-1.5 transition-all"
          title="Tải gói cấu hình âm thanh dự phòng từ thiết bị"
          id="btn-import-backup"
        >
          <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
          LOAD BACKUP
        </button>

        {/* Hidden import inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportFile}
          accept=".json"
          className="hidden"
          id="hidden-import-input"
        />
      </div>
    </footer>
  );
}
