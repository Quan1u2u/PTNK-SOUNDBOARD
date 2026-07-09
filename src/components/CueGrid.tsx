import React, { useRef, useState } from "react";
import { useAudioStore, storeActions } from "../lib/store";
import { AudioFileConfig } from "../types";
import { Play, Square, Upload, Trash2, Edit2, Check, Sliders, VolumeX, RotateCcw } from "lucide-react";

export default function CueGrid() {
  const state = useAudioStore();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Temp form state for editing
  const [tempTitle, setTempTitle] = useState("");
  const [tempSubtitle, setTempSubtitle] = useState("");
  const [tempVolume, setTempVolume] = useState(0.8);
  const [tempLoop, setTempLoop] = useState(true);

  const startEditing = (cue: AudioFileConfig) => {
    setEditingId(cue.id);
    setTempTitle(cue.title);
    setTempSubtitle(cue.subtitle || "");
    setTempVolume(cue.volume);
    setTempLoop(cue.loop ?? true);
  };

  const saveEdit = async (id: string) => {
    await storeActions.updateConfig(id, {
      title: tempTitle,
      subtitle: tempSubtitle,
      volume: tempVolume,
      loop: tempLoop,
    });
    setEditingId(null);
  };

  const triggerFileSelect = (id: string) => {
    fileInputRefs.current[id]?.click();
  };

  const handleFileChange = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await storeActions.handleFileUpload(id, file);
    }
  };

  const handleBatchFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files) as File[];
      await storeActions.handleBatchFileUpload(fileArray);
    }
  };

  // Drag and Drop handlers
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(null);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("audio/") || file.name.endsWith(".mp3") || file.name.endsWith(".wav") || file.name.endsWith(".m4a"))) {
      await storeActions.handleFileUpload(id, file);
    }
  };

  return (
    <section className="flex flex-col gap-4 select-none" id="cue-grid-section">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" id="cue-grid-header">
        <h2 className="text-white font-bold text-sm tracking-tight flex flex-col gap-1 sm:gap-2">
          DANH SÁCH EVENT CUES (20 PHẦN LỄ KHÓA)
          <span className="text-[10px] text-slate-500 font-mono font-normal">Grid: 4x5 • Shortcuts: [1]-[0] & [Q]-[P]</span>
        </h2>
        <div className="flex items-center gap-2" id="batch-upload-container">
          <input
            type="file"
            ref={batchFileInputRef}
            onChange={handleBatchFileChange}
            multiple
            accept="audio/*,.mp3,.wav,.m4a"
            className="hidden"
            id="batch-upload-input"
          />
          <button
            onClick={() => batchFileInputRef.current?.click()}
            className="w-full sm:w-auto px-3.5 py-1.5 bg-[#00E5FF]/10 hover:bg-[#00E5FF]/25 text-[#00E5FF] border border-[#00E5FF]/20 hover:border-[#00E5FF]/40 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
            id="btn-batch-upload"
          >
            <Upload className="w-3.5 h-3.5" />
            IMPORT HÀNG LOẠT
          </button>
        </div>
      </div>
 
      {/* Grid wrapper */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" id="cue-buttons-grid">
        {state.currentProfile.cues.map((cue, index) => {
          const isCueActive = state.currentCueId === cue.id;
          const isEditing = editingId === cue.id;
          const isDragOver = dragOverId === cue.id;
 
          // Keyboard shortcut label
          const keyLabel = index < 10
            ? (index === 9 ? "0" : (index + 1).toString())
            : ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"][index - 10];
 
          return (
            <div
              key={cue.id}
              data-cue-id={cue.id}
              onDragOver={(e) => handleDragOver(e, cue.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, cue.id)}
              className={`relative rounded-xl border p-3 min-h-[74px] flex flex-col justify-center transition-all duration-250 cursor-pointer group select-none ${
                isCueActive
                  ? state.isPlaying
                    ? "bg-[#00E5FF]/10 border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)] ring-1 ring-[#00E5FF]/30"
                    : "bg-amber-500/5 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20 animate-pulse"
                  : isDragOver
                  ? "bg-[#00E5FF]/10 border-[#00E5FF] border-dashed"
                  : "bg-[#0D152B] hover:bg-[#111B35] border-[#1E2E5A] hover:border-[#00E5FF]"
              }`}
              onClick={() => {
                if (!state.isEditMode && !isEditing) {
                  if (isCueActive) {
                    storeActions.togglePauseCue();
                  } else {
                    storeActions.playCue(cue);
                  }
                }
              }}
              id={`cue-card-${cue.id}`}
            >
              {/* Keyboard Hotkey Badge */}
              <div
                className={`absolute top-2 right-2 w-5.5 h-5.5 rounded-md font-mono text-[10px] font-bold flex items-center justify-center border transition-colors ${
                  isCueActive
                    ? state.isPlaying
                      ? "bg-[#00E5FF] text-[#050A18] border-[#00E5FF]"
                      : "bg-amber-500 text-[#050A18] border-amber-500"
                    : "bg-[#050A18] text-[#00E5FF] border-[#1E2E5A]"
                }`}
                id={`hotkey-${cue.id}`}
              >
                {keyLabel}
              </div>
 
              {/* CARD CONTENT */}
              <div className="flex flex-col gap-0.5 pr-6" id={`card-content-${cue.id}`}>
                <div className="flex items-center gap-1" id={`title-row-${cue.id}`}>
                  <h3
                    className={`font-bold text-[11px] tracking-tight uppercase line-clamp-1 transition-colors ${
                      isCueActive
                        ? state.isPlaying
                          ? "text-[#00E5FF]"
                          : "text-amber-400"
                        : "text-slate-200"
                    }`}
                    id={`title-${cue.id}`}
                  >
                    {cue.title}
                  </h3>
                </div>
              </div>
 
              {/* LIVE PLAYBACK PROGRESS INDICATOR INSIDE CARD */}
              {isCueActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#050A18] overflow-hidden rounded-b-xl" id={`card-prog-bar-${cue.id}`}>
                  <div
                    className={`h-full rounded-b-xl transition-all duration-100 ease-linear ${
                      state.isPlaying
                        ? "bg-[#00E5FF] shadow-[0_0_4px_#00E5FF]"
                        : "bg-amber-500 shadow-[0_0_4px_#F59E0B]"
                    }`}
                    style={{ width: `${state.currentDuration > 0 ? (state.currentTime / state.currentDuration) * 100 : 0}%` }}
                    id={`card-prog-fill-${cue.id}`}
                  />
                </div>
              )}

              {/* INTERACTIVE CONTROLS UNDER EDIT/CONFIG MODE */}
              {state.isEditMode ? (
                <div className="mt-3.5 pt-3 border-t border-[#1E2E5A] flex flex-col gap-3 z-10" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    // Edit Form Expanded
                    <div className="flex flex-col gap-2.5" id={`edit-form-${cue.id}`}>
                      {/* Name input */}
                      <input
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value.toUpperCase())}
                        className="bg-[#050A18] border border-[#1E2E5A] text-white rounded px-2.5 py-1 text-xs font-bold tracking-tight focus:outline-none focus:border-[#00E5FF]"
                        placeholder="TÊN EVENT CUE"
                        id={`input-title-${cue.id}`}
                      />
                      {/* Subtitle description */}
                      <textarea
                        value={tempSubtitle}
                        onChange={(e) => setTempSubtitle(e.target.value)}
                        className="bg-[#050A18] border border-[#1E2E5A] text-slate-300 rounded px-2.5 py-1 text-[10px] leading-relaxed focus:outline-none focus:border-[#00E5FF] h-11 resize-none"
                        placeholder="Mô tả công việc / thời điểm phát"
                        id={`input-sub-${cue.id}`}
                      />
                      {/* Volume tweak slider */}
                      <div className="flex items-center justify-between gap-2" id={`vol-row-${cue.id}`}>
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">VOL CALIBRATION</span>
                        <div className="flex items-center gap-1.5" id={`vol-slider-wrap-${cue.id}`}>
                          <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.05"
                            value={tempVolume}
                            onChange={(e) => setTempVolume(parseFloat(e.target.value))}
                            className="w-16 h-1 bg-[#050A18] rounded appearance-none cursor-pointer accent-[#00E5FF]"
                            id={`input-vol-${cue.id}`}
                          />
                          <span className="text-[9px] font-mono font-bold text-[#00E5FF]">{Math.round(tempVolume * 100)}%</span>
                        </div>
                      </div>
                      {/* Loop setting toggle */}
                      <div className="flex items-center justify-between gap-2" id={`loop-row-${cue.id}`}>
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">LOOP MODE</span>
                        <input
                          type="checkbox"
                          checked={tempLoop}
                          onChange={(e) => setTempLoop(e.target.checked)}
                          className="w-3.5 h-3.5 accent-[#00E5FF] cursor-pointer"
                          id={`input-loop-${cue.id}`}
                        />
                      </div>
                      {/* Save button */}
                      <button
                        onClick={() => saveEdit(cue.id)}
                        className="w-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 py-1.5 px-2 rounded font-mono text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                        id={`btn-save-${cue.id}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        LƯU CẤU HÌNH
                      </button>
                    </div>
                  ) : (
                    // Regular Edit Menu Options
                    <div className="flex flex-col gap-2" id={`edit-menu-${cue.id}`}>
                      {/* Upload / Revert Row */}
                      <div className="flex gap-1.5" id={`upload-actions-${cue.id}`}>
                        <button
                          onClick={() => triggerFileSelect(cue.id)}
                          className="flex-1 bg-[#00E5FF]/10 hover:bg-[#00E5FF]/15 text-[#00E5FF] py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 border border-[#00E5FF]/10 transition-colors"
                          title="Tải lên file MP3/WAV"
                          id={`btn-upload-${cue.id}`}
                        >
                          <Upload className="w-3 h-3" />
                          FILE AUDIO
                        </button>
                        {cue.isCustom && (
                          <button
                            onClick={() => storeActions.removeCustomFile(cue.id)}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 p-1 rounded border border-rose-500/10 transition-colors"
                            title="Xóa nhạc tự chọn, dùng nhạc Synth"
                            id={`btn-remove-${cue.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* File feedback indicator */}
                      <div className="text-[9px] font-mono text-slate-500 bg-[#050A18]/60 px-1.5 py-1 rounded truncate leading-none" id={`file-name-${cue.id}`}>
                        {cue.isCustom ? `File: ${cue.fileName}` : "Synthesized fallback"}
                      </div>

                      {/* Config Button */}
                      <button
                        onClick={() => startEditing(cue)}
                        className="w-full bg-[#050A18] hover:bg-[#111B35] border border-[#1E2E5A] text-slate-400 hover:text-slate-200 py-1 px-2 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                        id={`btn-config-${cue.id}`}
                      >
                        <Sliders className="w-3 h-3 text-[#00E5FF]" />
                        SỬA TIÊU ĐỀ & VOL
                      </button>

                      {/* Hidden File Input */}
                      <input
                        type="file"
                        ref={(el) => { fileInputRefs.current[cue.id] = el; }}
                        onChange={(e) => handleFileChange(cue.id, e)}
                        accept="audio/*"
                        className="hidden"
                        id={`hidden-input-${cue.id}`}
                      />
                    </div>
                  )}
                </div>
              ) : (
                // Standby details or controls in Live Mode
                <div className="flex items-center justify-between text-[10px] font-mono mt-3 text-slate-600 group-hover:text-slate-400 transition-colors" id={`card-footer-${cue.id}`}>
                  <span className="flex items-center gap-1">
                    {cue.isCustom ? "📁 " : "🎹 "}
                    {cue.isCustom ? "Local File" : "Synth"}
                  </span>
                  {isCueActive ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        storeActions.stopCue(cue.id);
                      }}
                      className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-0.5 border border-rose-500/20 px-1.5 py-0.5 rounded bg-rose-500/10 transition-all z-10 animate-pulse"
                      title="Dừng phát"
                      id={`btn-stop-card-${cue.id}`}
                    >
                      <Square className="w-2.5 h-2.5 fill-current" />
                      STOP
                    </button>
                  ) : (
                    <span className="text-[9px] uppercase tracking-wider font-bold">READY</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend / Ghi chú ô có nhạc hay không có nhạc */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono text-slate-500 bg-[#0D152B]/40 border border-[#1E2E5A]/40 rounded-lg py-2.5 px-4 w-fit mx-auto" id="cue-grid-legend">
        <span className="flex items-center gap-1.5" id="legend-custom-file">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
          <span className="flex items-center gap-1">📁 <strong>Ô có nhạc:</strong> Đã tải lên file âm thanh riêng (Local File)</span>
        </span>
        <span className="flex items-center gap-1.5" id="legend-synth">
          <span className="w-2 h-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.5)]"></span>
          <span className="flex items-center gap-1">🎹 <strong>Ô dùng Synth:</strong> Dùng nhạc mô phỏng mặc định (Synthfallback)</span>
        </span>
      </div>
    </section>
  );
}
