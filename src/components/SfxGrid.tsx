import React, { useRef, useState } from "react";
import { useAudioStore, storeActions } from "../lib/store";
import { AudioFileConfig } from "../types";
import { Upload, Trash2, Sliders, Check, Settings } from "lucide-react";

export default function SfxGrid() {
  const state = useAudioStore();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [tempEmoji, setTempEmoji] = useState("");
  const [tempTitle, setTempTitle] = useState("");
  const [tempVolume, setTempVolume] = useState(0.8);
  const [tempLoop, setTempLoop] = useState(false);

  const startEditing = (sfx: AudioFileConfig) => {
    setEditingId(sfx.id);
    setTempEmoji(sfx.emoji || "🔔");
    setTempTitle(sfx.title);
    setTempVolume(sfx.volume);
    setTempLoop(sfx.loop ?? false);
  };

  const saveEdit = async (id: string) => {
    await storeActions.updateConfig(id, {
      emoji: tempEmoji,
      title: tempTitle,
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

  // Drag over handlers
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
    if (file && (file.type.startsWith("audio/") || file.name.endsWith(".mp3") || file.name.endsWith(".wav"))) {
      await storeActions.handleFileUpload(id, file);
    }
  };

  return (
    <section className="bg-[#081023] border border-[#1E2E5A] rounded-xl p-5 h-full flex flex-col shadow-lg select-none" id="sfx-panel">
      <div className="flex items-center justify-between mb-4" id="sfx-header">
        <h2 className="text-[#00E5FF] font-mono text-xs font-bold uppercase tracking-wider" id="sfx-section-title">
          Hiệu ứng Âm thanh (SFX)
        </h2>
        <span className="text-[10px] text-slate-500 font-mono font-normal">Hotkeys: Z - S</span>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-3 gap-2.5 overflow-y-auto flex-1 max-h-[500px]" id="sfx-cards-grid">
        {state.currentProfile.sfxs.map((sfx) => {
          const isPlaying = state.activeSfxIds.includes(sfx.id);
          const isEditing = editingId === sfx.id;
          const isDragOver = dragOverId === sfx.id;

          return (
            <div
              key={sfx.id}
              onDragOver={(e) => handleDragOver(e, sfx.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, sfx.id)}
              className={`relative rounded-xl border p-4.5 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer ${
                isPlaying
                  ? "bg-[#FF3D00]/10 border-[#FF3D00] shadow-[0_0_12px_rgba(255,61,0,0.25)] scale-[1.02]"
                  : isDragOver
                  ? "bg-[#FF3D00]/15 border-dashed border-[#FF3D00]"
                  : "bg-[#0D152B] hover:bg-[#111B35] border-[#1E2E5A] hover:border-[#FF3D00]"
              }`}
              onClick={() => {
                if (!state.isEditMode && !isEditing) {
                  storeActions.playSfx(sfx);
                }
              }}
              id={`sfx-card-${sfx.id}`}
            >
              {/* Keyboard shortcut label top-right */}
              <span
                className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-mono font-extrabold border leading-none ${
                  isPlaying
                    ? "bg-[#FF3D00] text-[#050A18] border-[#FF3D00]"
                    : "bg-[#050A18] text-[#FF3D00] border-[#1E2E5A]"
                }`}
                id={`sfx-hotkey-badge-${sfx.id}`}
              >
                {sfx.hotkey}
              </span>

              {/* CARD MAIN DISPLAY */}
              {!isEditing && (
                <div className="flex flex-col items-center gap-1.5" id={`sfx-display-wrap-${sfx.id}`}>
                  {/* Big Emoji */}
                  <span className={`text-2xl select-none filter drop-shadow ${isPlaying ? "animate-bounce" : ""}`} id={`sfx-emoji-${sfx.id}`}>
                    {sfx.emoji || "👏"}
                  </span>
                  {/* Title */}
                  <h4 className={`font-bold text-[11px] tracking-tight truncate max-w-[100px] uppercase ${isPlaying ? "text-[#FF3D00] font-extrabold" : "text-slate-300"}`} id={`sfx-title-${sfx.id}`}>
                    {sfx.title}
                  </h4>
                </div>
              )}

              {/* CONFIG MODE CONTROLS */}
              {state.isEditMode ? (
                <div className="mt-3.5 pt-3 border-t border-[#1E2E5A] w-full flex flex-col gap-2.5 z-10" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    // Edit Form Expanded
                    <div className="flex flex-col gap-2 text-left" id={`sfx-edit-form-${sfx.id}`}>
                      {/* Emoji select */}
                      <div className="flex flex-col gap-0.5" id={`sfx-emoji-edit-${sfx.id}`}>
                        <span className="text-[8px] font-mono font-bold text-slate-500 uppercase">BIỂU TƯỢNG (EMOJI)</span>
                        <input
                          type="text"
                          maxLength={2}
                          value={tempEmoji}
                          onChange={(e) => setTempEmoji(e.target.value)}
                          className="bg-[#050A18] border border-[#1E2E5A] text-white rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#00E5FF] w-full"
                          id={`input-sfx-emoji-${sfx.id}`}
                        />
                      </div>
                      {/* Title select */}
                      <div className="flex flex-col gap-0.5" id={`sfx-title-edit-${sfx.id}`}>
                        <span className="text-[8px] font-mono font-bold text-slate-500 uppercase">TÊN SFX</span>
                        <input
                          type="text"
                          value={tempTitle}
                          onChange={(e) => setTempTitle(e.target.value.toUpperCase())}
                          className="bg-[#050A18] border border-[#1E2E5A] text-white rounded px-2 py-0.5 text-xs font-bold focus:outline-none focus:border-[#00E5FF] w-full"
                          id={`input-sfx-title-${sfx.id}`}
                        />
                      </div>
                      {/* Volume tweak slider */}
                      <div className="flex flex-col gap-0.5" id={`sfx-vol-edit-${sfx.id}`}>
                        <div className="flex justify-between items-center" id={`sfx-vol-label-${sfx.id}`}>
                          <span className="text-[8px] font-mono font-bold text-slate-500 uppercase">VOL</span>
                          <span className="text-[9px] font-mono text-[#00E5FF] font-bold">{Math.round(tempVolume * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.05"
                          value={tempVolume}
                          onChange={(e) => setTempVolume(parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#050A18] rounded appearance-none cursor-pointer accent-[#00E5FF]"
                          id={`input-sfx-vol-${sfx.id}`}
                        />
                      </div>
                      {/* Loop setting toggle */}
                      <div className="flex items-center justify-between gap-2" id={`sfx-loop-edit-${sfx.id}`}>
                        <span className="text-[8px] font-mono font-bold text-slate-500 uppercase">LẶP VÔ HẠN</span>
                        <input
                          type="checkbox"
                          checked={tempLoop}
                          onChange={(e) => setTempLoop(e.target.checked)}
                          className="w-3 h-3 accent-[#00E5FF] cursor-pointer"
                          id={`input-sfx-loop-${sfx.id}`}
                        />
                      </div>
                      {/* Save btn */}
                      <button
                        onClick={() => saveEdit(sfx.id)}
                        className="w-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 py-1.5 px-2 rounded font-mono text-[9px] font-bold flex items-center justify-center gap-1 transition-colors mt-1"
                        id={`btn-sfx-save-${sfx.id}`}
                      >
                        <Check className="w-3 h-3" />
                        LƯU CẤU HÌNH
                      </button>
                    </div>
                  ) : (
                    // In Edit Mode, standard menu options
                    <div className="flex flex-col gap-1.5" id={`sfx-edit-menu-${sfx.id}`}>
                      <div className="flex gap-1" id={`sfx-edit-upload-${sfx.id}`}>
                        <button
                          onClick={() => triggerFileSelect(sfx.id)}
                          className="flex-1 bg-[#00E5FF]/10 hover:bg-[#00E5FF]/15 text-[#00E5FF] py-1 px-1 rounded text-[9px] font-bold flex items-center justify-center gap-1 border border-[#00E5FF]/10 transition-all"
                          title="Tải lên file SFX mới"
                          id={`btn-sfx-upload-${sfx.id}`}
                        >
                          <Upload className="w-3 h-3" />
                          FILE
                        </button>
                        {sfx.isCustom && (
                          <button
                            onClick={() => storeActions.removeCustomFile(sfx.id)}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 p-1 rounded border border-rose-500/10 transition-colors"
                            title="Xóa nhạc tự chọn, dùng nhạc Synth"
                            id={`btn-sfx-remove-${sfx.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* File indicator info */}
                      <div className="text-[8px] font-mono text-slate-500 bg-[#050A18]/60 px-1 py-0.5 rounded truncate leading-none" id={`sfx-file-indicator-${sfx.id}`}>
                        {sfx.isCustom ? "📁 Custom" : "🎹 Synth"}
                      </div>

                      <button
                        onClick={() => startEditing(sfx)}
                        className="w-full bg-[#050A18] hover:bg-[#111B35] border border-[#1E2E5A] text-slate-400 hover:text-slate-200 py-1 px-1.5 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition-colors"
                        id={`btn-sfx-config-${sfx.id}`}
                      >
                        <Settings className="w-3 h-3 text-[#00E5FF]" />
                        CẤU HÌNH
                      </button>

                      <input
                        type="file"
                        ref={(el) => { fileInputRefs.current[sfx.id] = el; }}
                        onChange={(e) => handleFileChange(sfx.id, e)}
                        accept="audio/*"
                        className="hidden"
                        id={`hidden-input-sfx-${sfx.id}`}
                      />
                    </div>
                  )}
                </div>
              ) : (
                // Live mode footer
                <div className="text-[8px] font-mono text-slate-600 mt-2" id={`sfx-live-footer-${sfx.id}`}>
                  {sfx.isCustom ? "📁 Custom" : "🎹 Synthesized"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
