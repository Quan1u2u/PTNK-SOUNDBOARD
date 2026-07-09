import { useState, useEffect } from "react";
import { AudioFileConfig, PtnkEventProfile, DEFAULT_CUE_PRESETS, DEFAULT_SFX_PRESETS } from "../types";
import { audioEngine } from "./audioEngine";
import { getSettings, saveSettings, saveProfile, getProfile, getAllProfiles, saveAudioFile, deleteAudioFile } from "./db";

// Helper to create initial default configs with full volumes
function generateDefaultProfile(id: string, name: string): PtnkEventProfile {
  const cues: AudioFileConfig[] = DEFAULT_CUE_PRESETS.map((preset) => ({
    ...preset,
    volume: (preset.id === "cue-2" || preset.id === "cue-3") ? 0.9 : 0.75, // Anthem volume higher
  }));

  const sfxs: AudioFileConfig[] = DEFAULT_SFX_PRESETS.map((preset) => ({
    ...preset,
    volume: 0.8,
  }));

  return {
    id,
    name,
    description: `Kịch bản âm thanh chuẩn bị riêng cho ${name} tại PTNK`,
    cues,
    sfxs,
  };
}

export interface AppState {
  activeProfileId: string;
  profiles: PtnkEventProfile[];
  currentProfile: PtnkEventProfile;
  isEditMode: boolean;
  masterVolume: number;
  crossfadeTime: number;
  fadeInTime: number;
  fadeOutTime: number;
  isDucked: boolean;
  currentCueId: string | null;
  isPlaying: boolean;
  activeSfxIds: string[];
  currentTime: number;
  currentDuration: number;
}

// Global state callback registry
const listeners = new Set<(state: AppState) => void>();

let globalState: AppState = {
  activeProfileId: "main-profile",
  profiles: [],
  currentProfile: generateDefaultProfile("main-profile", "BẢN ĐIỀU KHIỂN ÂM THANH"),
  isEditMode: false,
  masterVolume: 0.8,
  crossfadeTime: 1.5,
  fadeInTime: 0.5,
  fadeOutTime: 1.0,
  isDucked: false,
  currentCueId: null,
  isPlaying: false,
  activeSfxIds: [],
  currentTime: 0,
  currentDuration: 0,
};

function emitChange() {
  listeners.forEach((listener) => listener({ ...globalState }));
}

// Load initial data from DB or generate defaults
export async function initializeStore() {
  try {
    // 1. Load app settings
    const settings = await getSettings();
    if (settings) {
      globalState.activeProfileId = settings.activeProfileId;
      globalState.masterVolume = settings.masterVolume;
      globalState.crossfadeTime = settings.crossfadeTime;
      globalState.fadeInTime = settings.fadeInTime;
      globalState.fadeOutTime = settings.fadeOutTime;
      globalState.isDucked = settings.isDucked;

      audioEngine.setMasterVolume(settings.masterVolume);
      audioEngine.setCrossfadeTime(settings.crossfadeTime);
      audioEngine.setFadeInTime(settings.fadeInTime);
      audioEngine.setFadeOutTime(settings.fadeOutTime);
      audioEngine.toggleDucking(settings.isDucked);
    } else {
      // First run: save current settings
      await saveSettings({
        activeProfileId: globalState.activeProfileId,
        masterVolume: globalState.masterVolume,
        crossfadeTime: globalState.crossfadeTime,
        fadeInTime: globalState.fadeInTime,
        fadeOutTime: globalState.fadeOutTime,
        isDucked: globalState.isDucked,
      });
    }

    // 2. Load profiles
    let loadedProfiles = await getAllProfiles();
    let mainProf = loadedProfiles.find((p) => p.id === "main-profile");
    if (!mainProf) {
      mainProf = generateDefaultProfile("main-profile", "BẢN ĐIỀU KHIỂN ÂM THANH");
      await saveProfile(mainProf);
    }

    // Ensure it has 20 cues and proper hotkeys
    let modified = false;
    if (mainProf.cues.length < 20) {
      modified = true;
      const mergedCues = [...mainProf.cues];
      for (let i = mergedCues.length; i < DEFAULT_CUE_PRESETS.length; i++) {
        const preset = DEFAULT_CUE_PRESETS[i];
        mergedCues.push({
          ...preset,
          volume: 0.75,
        });
      }
      mainProf.cues = mergedCues;
    }

    // Sync all cue titles, subtitles, hotkeys, and loop settings to match the new DEFAULT_CUE_PRESETS layout
    const updatedCues = mainProf.cues.map((cue, idx) => {
      const preset = DEFAULT_CUE_PRESETS[idx];
      if (preset) {
        if (
          cue.title !== preset.title ||
          cue.subtitle !== preset.subtitle ||
          cue.hotkey !== preset.hotkey ||
          cue.loop !== preset.loop
        ) {
          modified = true;
          return {
            ...cue,
            title: preset.title,
            subtitle: preset.subtitle,
            hotkey: preset.hotkey,
            loop: preset.loop,
          };
        }
      }
      return cue;
    });
    mainProf.cues = updatedCues;

    const updatedSfxs = mainProf.sfxs.map((sfx, idx) => {
      const defaultPreset = DEFAULT_SFX_PRESETS[idx];
      if (defaultPreset && sfx.hotkey !== defaultPreset.hotkey) {
        modified = true;
        return {
          ...sfx,
          hotkey: defaultPreset.hotkey,
        };
      }
      return sfx;
    });
    mainProf.sfxs = updatedSfxs;

    if (modified) {
      await saveProfile(mainProf);
    }

    loadedProfiles = [mainProf];

    globalState.profiles = loadedProfiles;

    // Find current active profile
    const activeProf = loadedProfiles.find((p) => p.id === globalState.activeProfileId) || loadedProfiles[0];
    globalState.activeProfileId = activeProf.id;
    globalState.currentProfile = activeProf;

    // 3. Register listeners with audio engine
    audioEngine.registerStateChangeListener(() => {
      const activeCueId = audioEngine.getActiveCueId();
      globalState.currentCueId = activeCueId;
      globalState.isPlaying = activeCueId !== null && !audioEngine.isCuePaused(activeCueId);
      globalState.isDucked = audioEngine.isDuckingActive();
      globalState.masterVolume = audioEngine.getMasterVolume();
      globalState.crossfadeTime = audioEngine.getCrossfadeTime();
      globalState.fadeInTime = audioEngine.getFadeInTime();
      globalState.fadeOutTime = audioEngine.getFadeOutTime();

      // Collect currently active playing sfxs
      globalState.activeSfxIds = globalState.currentProfile.sfxs
        .filter((sfx) => audioEngine.isSfxPlaying(sfx.id))
        .map((sfx) => sfx.id);

      emitChange();
    });

    audioEngine.registerTimeUpdateListener((cueId, elapsed, duration) => {
      globalState.currentTime = elapsed;
      globalState.currentDuration = duration;
      emitChange();
    });

    // 4. Preload any custom audio files from DB
    await audioEngine.loadCustomFilesFromDB(activeProf.cues, activeProf.sfxs);

    emitChange();
  } catch (e) {
    console.error("Failed to initialize store:", e);
  }
}

// React custom hook to subscribe to state
export function useAudioStore() {
  const [state, setState] = useState<AppState>(globalState);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}

// Action handlers
export const storeActions = {
  // Select active profile
  async selectProfile(profileId: string) {
    const targetProfile = globalState.profiles.find((p) => p.id === profileId);
    if (!targetProfile) return;

    audioEngine.stopAll();

    globalState.activeProfileId = profileId;
    globalState.currentProfile = targetProfile;
    globalState.currentTime = 0;
    globalState.currentDuration = 0;

    // Preload its files
    await audioEngine.loadCustomFilesFromDB(targetProfile.cues, targetProfile.sfxs);

    // Save settings
    await saveSettings({
      activeProfileId: globalState.activeProfileId,
      masterVolume: globalState.masterVolume,
      crossfadeTime: globalState.crossfadeTime,
      fadeInTime: globalState.fadeInTime,
      fadeOutTime: globalState.fadeOutTime,
      isDucked: globalState.isDucked,
    });

    emitChange();
  },

  // Set Master volume
  setMasterVolume(vol: number) {
    audioEngine.setMasterVolume(vol);
    globalState.masterVolume = vol;
    saveSettings({
      activeProfileId: globalState.activeProfileId,
      masterVolume: globalState.masterVolume,
      crossfadeTime: globalState.crossfadeTime,
      fadeInTime: globalState.fadeInTime,
      fadeOutTime: globalState.fadeOutTime,
      isDucked: globalState.isDucked,
    });
    emitChange();
  },

  setCrossfadeTime(seconds: number) {
    audioEngine.setCrossfadeTime(seconds);
    globalState.crossfadeTime = seconds;
    saveSettings({
      activeProfileId: globalState.activeProfileId,
      masterVolume: globalState.masterVolume,
      crossfadeTime: globalState.crossfadeTime,
      fadeInTime: globalState.fadeInTime,
      fadeOutTime: globalState.fadeOutTime,
      isDucked: globalState.isDucked,
    });
    emitChange();
  },

  setFadeInTime(seconds: number) {
    audioEngine.setFadeInTime(seconds);
    globalState.fadeInTime = seconds;
    saveSettings({
      activeProfileId: globalState.activeProfileId,
      masterVolume: globalState.masterVolume,
      crossfadeTime: globalState.crossfadeTime,
      fadeInTime: globalState.fadeInTime,
      fadeOutTime: globalState.fadeOutTime,
      isDucked: globalState.isDucked,
    });
    emitChange();
  },

  setFadeOutTime(seconds: number) {
    audioEngine.setFadeOutTime(seconds);
    globalState.fadeOutTime = seconds;
    saveSettings({
      activeProfileId: globalState.activeProfileId,
      masterVolume: globalState.masterVolume,
      crossfadeTime: globalState.crossfadeTime,
      fadeInTime: globalState.fadeInTime,
      fadeOutTime: globalState.fadeOutTime,
      isDucked: globalState.isDucked,
    });
    emitChange();
  },

  // Toggle Ducking
  toggleDucking() {
    audioEngine.toggleDucking();
    globalState.isDucked = audioEngine.isDuckingActive();
    saveSettings({
      activeProfileId: globalState.activeProfileId,
      masterVolume: globalState.masterVolume,
      crossfadeTime: globalState.crossfadeTime,
      fadeInTime: globalState.fadeInTime,
      fadeOutTime: globalState.fadeOutTime,
      isDucked: globalState.isDucked,
    });
    emitChange();
  },

  // Trigger play cue
  playCue(config: AudioFileConfig) {
    audioEngine.playCue(config);
  },

  togglePauseCue() {
    audioEngine.togglePauseCue();
  },

  stopCue(id: string) {
    audioEngine.stopCue(id);
  },

  stopAll() {
    audioEngine.stopAll();
  },

  undo() {
    audioEngine.undo();
  },

  playSfx(config: AudioFileConfig) {
    audioEngine.playSfx(config);
  },

  // Toggle Edit mode
  setEditMode(enabled: boolean) {
    globalState.isEditMode = enabled;
    emitChange();
  },

  // Save changes to current cue or sfx configurations
  async updateConfig(id: string, updates: Partial<AudioFileConfig>) {
    const isCue = id.startsWith("cue-");
    const profile = { ...globalState.currentProfile };

    if (isCue) {
      profile.cues = profile.cues.map((item) => (item.id === id ? { ...item, ...updates } : item));
    } else {
      profile.sfxs = profile.sfxs.map((item) => (item.id === id ? { ...item, ...updates } : item));
    }

    globalState.currentProfile = profile;
    globalState.profiles = globalState.profiles.map((p) => (p.id === profile.id ? profile : p));

    await saveProfile(profile);
    emitChange();
  },

  // Custom audio file upload handler
  async handleFileUpload(id: string, file: File) {
    const isCue = id.startsWith("cue-");

    // 1. Save binary Blob in IndexedDB
    await saveAudioFile(id, file);

    // 2. Clear old buffer and preload into memory
    await audioEngine.preloadCustomFile(id, file);

    // 3. Update active profile config
    await this.updateConfig(id, {
      isCustom: true,
      fileName: file.name,
    });
  },

  // Batch import audio files sequentially into Event Cues
  async handleBatchFileUpload(files: File[]) {
    const profile = { ...globalState.currentProfile };
    const cues = [...profile.cues];

    // Limit files to the total number of cues (25 or 20)
    const limit = Math.min(files.length, cues.length);
    for (let i = 0; i < limit; i++) {
      const file = files[i];
      const cue = cues[i];

      // 1. Save binary Blob in IndexedDB
      await saveAudioFile(cue.id, file);

      // 2. Clear old buffer and preload into memory
      await audioEngine.preloadCustomFile(cue.id, file);

      // 3. Extract title from file name (clean extensions and uppercase)
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "").toUpperCase();

      // 4. Update the cue config
      cues[i] = {
        ...cue,
        title: cleanTitle,
        subtitle: "", // Clear description for the new custom file
        isCustom: true,
        fileName: file.name,
      };
    }

    profile.cues = cues;
    globalState.currentProfile = profile;
    globalState.profiles = globalState.profiles.map((p) => (p.id === profile.id ? profile : p));

    await saveProfile(profile);
    emitChange();
  },

  // Remove custom file and revert to synth presets
  async removeCustomFile(id: string) {
    // 1. Delete binary from DB
    await deleteAudioFile(id);

    // 2. Revert config in state
    const isCue = id.startsWith("cue-");
    const defaults = isCue ? DEFAULT_CUE_PRESETS : DEFAULT_SFX_PRESETS;
    const defaultObj = defaults.find((d) => d.id === id);

    await this.updateConfig(id, {
      isCustom: false,
      fileName: undefined,
      title: defaultObj?.title || "",
      subtitle: (defaultObj as any)?.subtitle || undefined,
      emoji: (defaultObj as any)?.emoji || undefined,
    });

    emitChange();
  },

  // Create a completely new custom profile
  async createCustomProfile(name: string) {
    const id = `custom-${Date.now()}`;
    const newProfile = generateDefaultProfile(id, name);

    globalState.profiles.push(newProfile);
    await saveProfile(newProfile);
    await this.selectProfile(id);
  },

  // Delete a profile
  async deleteProfile(id: string) {
    if (globalState.profiles.length <= 1) return; // keep at least one

    globalState.profiles = globalState.profiles.filter((p) => p.id !== id);
    // Delete profile configuration (not deleting raw audio, in case other profiles use them)
    // Actually IndexedDB deleteProfile: we can expand db.ts or use openDB directly
    const db = await import("./db").then((m) => m.openDB());
    const tx = db.transaction("profiles", "readwrite");
    tx.objectStore("profiles").delete(id);

    // If active was deleted, fallback
    if (globalState.activeProfileId === id) {
      await this.selectProfile(globalState.profiles[0].id);
    } else {
      emitChange();
    }
  },

  // Reset entire active profile to its defaults
  async resetActiveProfileToDefaults() {
    const profileId = globalState.activeProfileId;
    const name = globalState.currentProfile.name;

    // Delete custom binary files for this profile
    for (const cue of globalState.currentProfile.cues) {
      if (cue.isCustom) await deleteAudioFile(cue.id);
    }
    for (const sfx of globalState.currentProfile.sfxs) {
      if (sfx.isCustom) await deleteAudioFile(sfx.id);
    }

    const resetProfile = generateDefaultProfile(profileId, name);
    globalState.currentProfile = resetProfile;
    globalState.profiles = globalState.profiles.map((p) => (p.id === profileId ? resetProfile : p));

    await saveProfile(resetProfile);
    emitChange();
  },

  // Export current active profile config + custom audios as a comprehensive backup bundle!
  async exportEventBackupBundle() {
    try {
      const profile = globalState.currentProfile;
      const audioData: Record<string, string> = {}; // id -> base64 string

      for (const cue of profile.cues) {
        if (cue.isCustom) {
          const blob = await import("./db").then((m) => m.getAudioFile(cue.id));
          if (blob) {
            const base64 = await new Promise<string>((resolve) => {
              const r = new FileReader();
              r.onloadend = () => resolve(r.result as string);
              r.readAsDataURL(blob);
            });
            audioData[cue.id] = base64;
          }
        }
      }

      for (const sfx of profile.sfxs) {
        if (sfx.isCustom) {
          const blob = await import("./db").then((m) => m.getAudioFile(sfx.id));
          if (blob) {
            const base64 = await new Promise<string>((resolve) => {
              const r = new FileReader();
              r.onloadend = () => resolve(r.result as string);
              r.readAsDataURL(blob);
            });
            audioData[sfx.id] = base64;
          }
        }
      }

      const bundle = {
        version: 1,
        profile,
        audioData,
      };

      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `PTNK-AUDIO-BACKUP-${profile.name.replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
      alert("Xuất dữ liệu dự phòng thất bại. Vui lòng thử lại!");
    }
  },

  // Import event backup bundle
  async importEventBackupBundle(file: File) {
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);

      if (bundle.version !== 1 || !bundle.profile || !bundle.audioData) {
        throw new Error("Invalid backup bundle structure");
      }

      const profile = bundle.profile as PtnkEventProfile;
      // Assign a unique custom ID so it doesn't overwrite core profiles if not intended,
      // or we can prompt or just overwrite. Overwriting or importing as custom is very clean.
      profile.id = `imported-${Date.now()}`;
      profile.name = `BẢN NHẬP - ${profile.name}`;

      // Save binary audios
      for (const [id, base64] of Object.entries(bundle.audioData)) {
        // Convert base64 to Blob
        const res = await fetch(base64 as string);
        const blob = await res.blob();
        await saveAudioFile(id.replace(/^(cue-|sfx-)/, `$1imported-${Date.now()}-`), blob);
      }

      // Update the profile IDs accordingly
      const suffix = `imported-${Date.now()}-`;
      profile.cues = profile.cues.map((cue) => {
        if (cue.isCustom && bundle.audioData[cue.id]) {
          return { ...cue, id: cue.id.replace(/^(cue-)/, `$1${suffix}`) };
        }
        return cue;
      });

      profile.sfxs = profile.sfxs.map((sfx) => {
        if (sfx.isCustom && bundle.audioData[sfx.id]) {
          return { ...sfx, id: sfx.id.replace(/^(sfx-)/, `$1${suffix}`) };
        }
        return sfx;
      });

      globalState.profiles.push(profile);
      await saveProfile(profile);
      await this.selectProfile(profile.id);
    } catch (e) {
      console.error("Import failed:", e);
      alert("Nhập bản sao lưu thất bại. Định dạng file không đúng hoặc bị lỗi!");
    }
  },
};
