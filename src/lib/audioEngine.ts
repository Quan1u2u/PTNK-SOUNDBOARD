import { AudioFileConfig } from "../types";
import { getAudioFile } from "./db";

export type PlaybackStatus = "STOPPED" | "PLAYING" | "PAUSED" | "DUCKED";

interface ActiveCueNode {
  id: string;
  sourceNode: AudioBufferSourceNode | null;
  synthNodes: AudioNode[]; // to track procedural nodes
  gainNode: GainNode;
  startTime: number;
  pauseTime: number; // offset in seconds if paused
  loop: boolean;
  isCustom: boolean;
  isFinished: boolean;
  isPaused?: boolean;
  config: AudioFileConfig;
  intervalId?: any; // for rhythmic procedural loops
}

class AudioEngine {
  public ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Active playing channels
  private activeCues: Map<string, ActiveCueNode> = new Map();
  private activeSfxs: Map<string, { source: AudioNode; gain: GainNode; startTime: number }> = new Map();

  // Decoded custom audio buffer cache
  private bufferCache: Map<string, AudioBuffer> = new Map();

  // Global settings
  private masterVolumeValue: number = 0.8;
  private crossfadeTime: number = 1.5;
  private fadeInTime: number = 0.5;
  private fadeOutTime: number = 1.0;
  private isDucked: boolean = false;

  // Listeners for UI state sync
  private onStateChange: (() => void) | null = null;
  private onTimeUpdate: ((cueId: string, elapsed: number, duration: number) => void) | null = null;
  private progressInterval: any = null;

  // Track the history for the Undo feature (re-triggering last state)
  private undoHistory: { action: string; previousCueId: string | null; wasPlaying: boolean }[] = [];

  constructor() {
    // Lazy initialisation will happen on first user interaction
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolumeValue, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;

      // Connect Master -> Analyser -> Destination
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.startProgressTracker();
    } catch (e) {
      console.error("Failed to initialize AudioContext:", e);
    }
  }

  public registerStateChangeListener(listener: () => void) {
    this.onStateChange = listener;
  }

  public registerTimeUpdateListener(listener: (cueId: string, elapsed: number, duration: number) => void) {
    this.onTimeUpdate = listener;
  }

  // Setters for settings
  public setMasterVolume(vol: number) {
    this.masterVolumeValue = vol;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    }
    this.triggerUpdate();
  }

  public getMasterVolume(): number {
    return this.masterVolumeValue;
  }

  public setCrossfadeTime(seconds: number) {
    this.crossfadeTime = seconds;
    this.triggerUpdate();
  }

  public getCrossfadeTime(): number {
    return this.crossfadeTime;
  }

  public setFadeInTime(seconds: number) {
    this.fadeInTime = seconds;
    this.triggerUpdate();
  }

  public getFadeInTime(): number {
    return this.fadeInTime;
  }

  public setFadeOutTime(seconds: number) {
    this.fadeOutTime = seconds;
    this.triggerUpdate();
  }

  public getFadeOutTime(): number {
    return this.fadeOutTime;
  }

  public isDuckingActive(): boolean {
    return this.isDucked;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  private triggerUpdate() {
    if (this.onStateChange) this.onStateChange();
  }

  // Preload a custom audio file from DB or local drop
  public async preloadCustomFile(id: string, fileBlob: Blob): Promise<void> {
    this.init();
    if (!this.ctx) return;

    try {
      const arrayBuffer = await fileBlob.arrayBuffer();
      // decodeAudioData consumes the buffer, so we use a copy of it
      const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(id, decodedBuffer);
      this.triggerUpdate();
    } catch (e) {
      console.error(`Error decoding custom file for ${id}:`, e);
      throw e;
    }
  }

  // Load custom files from IndexedDB into memory cache
  public async loadCustomFilesFromDB(cues: AudioFileConfig[], sfxs: AudioFileConfig[]) {
    this.init();
    const allConfigs = [...cues, ...sfxs];
    for (const config of allConfigs) {
      if (config.isCustom) {
        try {
          const blob = await getAudioFile(config.id);
          if (blob) {
            await this.preloadCustomFile(config.id, blob);
            console.log(`Preloaded custom file for ${config.id}: ${config.fileName}`);
          }
        } catch (e) {
          console.error(`Failed to preload ${config.id} on launch:`, e);
        }
      }
    }
  }

  // Play a specific Event Cue
  public async playCue(config: AudioFileConfig) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    // Save history for Undo
    const previousPlayingId = this.getActiveCueId();
    const wasPlaying = previousPlayingId !== null;
    this.pushUndoHistory("PLAY_CUE", previousPlayingId, wasPlaying);

    const now = this.ctx.currentTime;
    const fadeOutDuration = this.crossfadeTime;

    // 1. Crossfade out ALL currently active cues
    this.activeCues.forEach((activeNode, cueId) => {
      if (cueId !== config.id) {
        // Fade out
        activeNode.gainNode.gain.setValueAtTime(activeNode.gainNode.gain.value, now);
        activeNode.gainNode.gain.linearRampToValueAtTime(0.0, now + fadeOutDuration);

        // Stop after fade out
        setTimeout(() => {
          this.stopCueNode(activeNode);
          this.activeCues.delete(cueId);
          this.triggerUpdate();
        }, fadeOutDuration * 1000 + 50);
      }
    });

    // 2. Check if this same cue is already playing. If so, just make sure it's fully faded in
    const existingNode = this.activeCues.get(config.id);
    if (existingNode && !existingNode.isFinished) {
      existingNode.gainNode.gain.setValueAtTime(existingNode.gainNode.gain.value, now);
      const targetVolume = config.volume * (this.isDucked ? 0.1 : 1.0);
      existingNode.gainNode.gain.linearRampToValueAtTime(targetVolume, now + this.fadeInTime);
      this.triggerUpdate();
      return;
    }

    // 3. Create the Gain Node for the new cue
    const cueGain = this.ctx.createGain();
    cueGain.gain.setValueAtTime(0.001, now); // start silent

    // Apply ducking state directly
    const targetVolume = config.volume * (this.isDucked ? 0.1 : 1.0);
    cueGain.gain.linearRampToValueAtTime(targetVolume, now + this.fadeInTime);

    cueGain.connect(this.masterGain);

    const activeNode: ActiveCueNode = {
      id: config.id,
      sourceNode: null,
      synthNodes: [],
      gainNode: cueGain,
      startTime: now,
      pauseTime: 0,
      loop: config.loop ?? false,
      isCustom: config.isCustom,
      isFinished: false,
      isPaused: false,
      config: config,
    };

    // 4. Play custom or procedural audio
    if (config.isCustom) {
      const buffer = this.bufferCache.get(config.id);
      if (buffer) {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = config.loop ?? false;
        source.connect(cueGain);

        source.onended = () => {
          activeNode.isFinished = true;
          // If not looping and finished naturally, clean up
          if (!source.loop) {
            setTimeout(() => {
              if (this.activeCues.get(config.id) === activeNode) {
                this.activeCues.delete(config.id);
                this.triggerUpdate();
              }
            }, 100);
          }
        };

        source.start(now);
        activeNode.sourceNode = source;
      } else {
        console.warn(`Custom audio buffer not cached for ${config.id}, falling back to synth!`);
        this.playProceduralCue(config.id, cueGain, activeNode);
      }
    } else {
      // Procedural/Synthetic playback
      this.playProceduralCue(config.id, cueGain, activeNode);
    }

    this.activeCues.set(config.id, activeNode);
    this.triggerUpdate();
  }

  // Toggle Pause/Resume of active Cue with smooth fade in/out
  public togglePauseCue() {
    this.init();
    if (!this.ctx) return;

    // We can have a playing cue or a paused cue in our activeCues map.
    let activeId: string | null = null;
    this.activeCues.forEach((node, id) => {
      if (!node.isFinished) {
        activeId = id;
      }
    });

    if (!activeId) return;

    const activeNode = this.activeCues.get(activeId)!;
    const now = this.ctx.currentTime;
    const config = activeNode.config;

    if (activeNode.isPaused) {
      // --- RESUMING ---
      activeNode.isPaused = false;
      
      if (activeNode.isCustom) {
        const buffer = this.bufferCache.get(config.id);
        if (buffer) {
          const source = this.ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = config.loop ?? false;
          source.connect(activeNode.gainNode);

          source.onended = () => {
            if (activeNode.isPaused) return;
            activeNode.isFinished = true;
            if (!source.loop) {
              setTimeout(() => {
                if (this.activeCues.get(config.id) === activeNode && !activeNode.isPaused) {
                  this.activeCues.delete(config.id);
                  this.triggerUpdate();
                }
              }, 100);
            }
          };

          activeNode.startTime = this.ctx.currentTime;
          source.start(now, activeNode.pauseTime);
          activeNode.sourceNode = source;
        }
      }

      // Smoothly fade the volume back up
      activeNode.gainNode.gain.setValueAtTime(activeNode.gainNode.gain.value, now);
      const targetVolume = config.volume * (this.isDucked ? 0.1 : 1.0);
      activeNode.gainNode.gain.linearRampToValueAtTime(targetVolume, now + this.fadeInTime);
      
      this.triggerUpdate();
    } else {
      // --- PAUSING ---
      // 1. Smoothly fade down to 0
      const fadeDuration = 0.5; // Quick 0.5s fade down for responsiveness
      activeNode.gainNode.gain.setValueAtTime(activeNode.gainNode.gain.value, now);
      activeNode.gainNode.gain.linearRampToValueAtTime(0.0, now + fadeDuration);

      activeNode.isPaused = true;
      this.triggerUpdate();

      // 2. After fade completes, stop custom buffer source node
      const captureNode = activeNode;
      const captureId = activeId;
      setTimeout(() => {
        if (this.activeCues.get(captureId) === captureNode && captureNode.isPaused) {
          if (captureNode.isCustom && captureNode.sourceNode) {
            const elapsedSinceStart = this.ctx!.currentTime - captureNode.startTime;
            const buffer = captureNode.sourceNode.buffer;
            if (buffer) {
              captureNode.pauseTime = (captureNode.pauseTime + elapsedSinceStart) % buffer.duration;
            }
            try {
              captureNode.sourceNode.stop();
            } catch (e) {}
            captureNode.sourceNode = null;
          }
          this.triggerUpdate();
        }
      }, fadeDuration * 1000);
    }
  }

  // Check if a specific Cue is paused
  public isCuePaused(id: string): boolean {
    const node = this.activeCues.get(id);
    return node ? (node.isPaused ?? false) : false;
  }

  // Stop active cue with fade out
  public stopCue(id: string) {
    const activeNode = this.activeCues.get(id);
    if (!activeNode || !this.ctx) return;

    this.pushUndoHistory("STOP_CUE", id, true);

    const now = this.ctx.currentTime;
    const fadeDuration = this.fadeOutTime;

    activeNode.gainNode.gain.setValueAtTime(activeNode.gainNode.gain.value, now);
    activeNode.gainNode.gain.linearRampToValueAtTime(0.0, now + fadeDuration);

    setTimeout(() => {
      this.stopCueNode(activeNode);
      if (this.activeCues.get(id) === activeNode) {
        this.activeCues.delete(id);
      }
      this.triggerUpdate();
    }, fadeDuration * 1000 + 50);
  }

  // Stop all cues and SFXs with smooth fade out for cues
  public stopAll() {
    this.init();
    if (!this.ctx) return;

    this.pushUndoHistory("STOP_ALL", this.getActiveCueId(), this.activeCues.size > 0);

    const now = this.ctx.currentTime;
    const fadeDuration = this.fadeOutTime;

    // Stop cues with smooth fade out
    this.activeCues.forEach((node, id) => {
      node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, now);
      node.gainNode.gain.linearRampToValueAtTime(0.0, now + fadeDuration);

      setTimeout(() => {
        this.stopCueNode(node);
        if (this.activeCues.get(id) === node) {
          this.activeCues.delete(id);
        }
        this.triggerUpdate();
      }, fadeDuration * 1000 + 50);
    });

    // Stop SFXs
    this.activeSfxs.forEach((node) => {
      try {
        if (node.source instanceof OscillatorNode || node.source instanceof AudioBufferSourceNode) {
          node.source.stop();
        }
      } catch (e) {}
    });
    this.activeSfxs.clear();

    this.triggerUpdate();
  }

  // Undo the last action (Restore previous cue playing state)
  public undo() {
    if (this.undoHistory.length === 0) return;
    const lastAction = this.undoHistory.pop()!;
    console.log("Undoing action:", lastAction);

    if (lastAction.action === "STOP_ALL" || lastAction.action === "STOP_CUE" || lastAction.action === "PLAY_CUE") {
      if (lastAction.previousCueId) {
        // Find the configuration for this cue and play it
        // We will trigger a synthetic state update to find the cue config in the UI component
        const configElement = document.querySelector(`[data-cue-id="${lastAction.previousCueId}"]`);
        if (configElement) {
          (configElement as HTMLElement).click();
        }
      } else {
        this.stopAll();
      }
    }
  }

  private pushUndoHistory(action: string, previousCueId: string | null, wasPlaying: boolean) {
    this.undoHistory.push({ action, previousCueId, wasPlaying });
    if (this.undoHistory.length > 20) {
      this.undoHistory.shift(); // keep last 20 actions
    }
  }

  // Helper to fully stop and disconnect a cue node
  private stopCueNode(node: ActiveCueNode) {
    if (node.intervalId) {
      clearInterval(node.intervalId);
    }
    if (node.sourceNode) {
      try {
        node.sourceNode.stop();
        node.sourceNode.disconnect();
      } catch (e) {}
    }
    node.synthNodes.forEach((synthNode) => {
      try {
        if (synthNode instanceof OscillatorNode) {
          synthNode.stop();
        }
        synthNode.disconnect();
      } catch (e) {}
    });
    try {
      node.gainNode.disconnect();
    } catch (e) {}
    node.isFinished = true;
  }

  // Toggle MC Ducking (Gradually decreases current music to 20% volume)
  public toggleDucking(forceState?: boolean) {
    this.init();
    if (!this.ctx) return;

    this.isDucked = forceState !== undefined ? forceState : !this.isDucked;
    const now = this.ctx.currentTime;
    const speed = 0.25; // 250ms ducking speed

    this.activeCues.forEach((node) => {
      // Find the base target volume of this cue config (we'll fetch it from cue elements or default to 0.8)
      // Since we don't have direct access to the config, we use the active node's gain current level
      // and ramp it down or back up.
      node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, now);
      const targetVolume = this.isDucked ? 0.08 : 0.8; // 10% of standard volume when ducked
      node.gainNode.gain.linearRampToValueAtTime(targetVolume, now + speed);
    });

    this.triggerUpdate();
  }

  // Get active playing cue ID (returns the first one that is currently active and not finished)
  public getActiveCueId(): string | null {
    let activeId: string | null = null;
    this.activeCues.forEach((node, id) => {
      if (!node.isFinished) {
        activeId = id;
      }
    });
    return activeId;
  }

  // Trigger Sound Effect (F1-F12)
  public async playSfx(config: AudioFileConfig) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // Create unique SFX Gain node
    const sfxGain = this.ctx.createGain();
    sfxGain.gain.setValueAtTime(config.volume, now);
    sfxGain.connect(this.masterGain);

    const sfxInfo = {
      source: null as any,
      gain: sfxGain,
      startTime: now,
    };

    if (config.isCustom) {
      const buffer = this.bufferCache.get(config.id);
      if (buffer) {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(sfxGain);
        source.start(now);
        sfxInfo.source = source;

        source.onended = () => {
          setTimeout(() => {
            sfxGain.disconnect();
            this.activeSfxs.delete(config.id);
            this.triggerUpdate();
          }, 100);
        };
        this.activeSfxs.set(config.id, sfxInfo);
      } else {
        console.warn(`Custom audio buffer not cached for SFX ${config.id}, using synth!`);
        this.playProceduralSfx(config.id, sfxGain, sfxInfo);
      }
    } else {
      // Synthetic SFX
      this.playProceduralSfx(config.id, sfxGain, sfxInfo);
    }

    this.triggerUpdate();
  }

  // Check if a specific SFX is playing
  public isSfxPlaying(id: string): boolean {
    return this.activeSfxs.has(id);
  }

  // Progress tracking interval loop
  private startProgressTracker() {
    if (this.progressInterval) return;

    this.progressInterval = setInterval(() => {
      if (!this.ctx) return;
      const activeId = this.getActiveCueId();
      if (!activeId || !this.onTimeUpdate) return;

      const activeNode = this.activeCues.get(activeId)!;
      const elapsedRaw = activeNode.isPaused
        ? activeNode.pauseTime
        : this.ctx.currentTime - activeNode.startTime + activeNode.pauseTime;

      let duration = 120.0; // default duration for procedural tracks
      if (activeNode.sourceNode && activeNode.sourceNode.buffer) {
        duration = activeNode.sourceNode.buffer.duration;
      }

      const elapsed = activeNode.loop ? elapsedRaw % duration : Math.min(elapsedRaw, duration);
      this.onTimeUpdate(activeId, elapsed, duration);
    }, 100);
  }

  /* ==========================================================
     PROCEDURAL SYNTHESIZERS (WEB AUDIO API CUES & SFX)
     These generate incredible soundscapes out of the box!
     ========================================================== */

  private playProceduralCue(id: string, gainNode: GainNode, activeNode: ActiveCueNode) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    switch (id) {
      case "cue-1": {
        // ĐÓN KHÁCH (Lush, slow ambient sweep)
        // Let's create a beautiful triad chord sequence: C3, G3, C4, E4, B4
        const frequencies = [130.81, 196.0, 261.63, 329.63, 493.88];
        frequencies.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const pGain = this.ctx!.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);

          // Give a slow, lovely detuning to make it lush
          const lfo = this.ctx!.createOscillator();
          const lfoGain = this.ctx!.createGain();
          lfo.frequency.setValueAtTime(0.1 + idx * 0.05, now);
          lfoGain.gain.setValueAtTime(1.5, now);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);

          pGain.gain.setValueAtTime(0.05, now);

          // Connect
          osc.connect(pGain);
          pGain.connect(gainNode);

          lfo.start(now);
          osc.start(now);

          activeNode.synthNodes.push(osc, lfo, pGain, lfoGain);
        });
        break;
      }

      case "cue-2": {
        // CHÀO CỜ (State National Anthem style military horns)
        // High-pitch noble trumpets playing standard fanfare intervals
        const hornProgression = [
          { f: 261.63, t: 0 },   // C4
          { f: 329.63, t: 0.5 }, // E4
          { f: 392.00, t: 1.0 }, // G4
          { f: 523.25, t: 1.5 }, // C5
          { f: 392.00, t: 2.5 }, // G4
          { f: 523.25, t: 3.0 }, // C5
          { f: 659.25, t: 3.5 }, // E5
          { f: 523.25, t: 4.0 }, // C5
          { f: 783.99, t: 4.5 }, // G5
        ];

        hornProgression.forEach((note) => {
          const osc1 = this.ctx!.createOscillator();
          const osc2 = this.ctx!.createOscillator();
          const noteGain = this.ctx!.createGain();

          osc1.type = "sawtooth";
          osc2.type = "triangle";

          osc1.frequency.setValueAtTime(note.f, now + note.t);
          osc2.frequency.setValueAtTime(note.f * 1.005, now + note.t); // micro detuning

          // Low pass filter to make it brassy instead of buzzy
          const filter = this.ctx!.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(1200, now + note.t);

          noteGain.gain.setValueAtTime(0, now);
          noteGain.gain.setValueAtTime(0, now + note.t);
          noteGain.gain.linearRampToValueAtTime(0.12, now + note.t + 0.05);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + note.t + 0.48);

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(gainNode);

          osc1.start(now + note.t);
          osc2.start(now + note.t);

          activeNode.synthNodes.push(osc1, osc2, filter, noteGain);
        });

        // Set interval to repeat the anthem sequence if loop is true
        if (activeNode.loop) {
          activeNode.intervalId = setInterval(() => {
            this.playProceduralCue(id, gainNode, activeNode);
          }, 6000);
        }
        break;
      }

      case "cue-3": {
        // TUYÊN BỐ LÝ DO (Opening speech backing drone - Noble & deep)
        const baseFreqs = [110.0, 165.0, 220.0]; // A2, E3, A3 chord
        baseFreqs.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const pGain = this.ctx!.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now);

          // Very slow volume breathing
          pGain.gain.setValueAtTime(0.1, now);
          const lfo = this.ctx!.createOscillator();
          const lfoGain = this.ctx!.createGain();
          lfo.frequency.setValueAtTime(0.15, now);
          lfoGain.gain.setValueAtTime(0.03, now);
          lfo.connect(lfoGain);
          lfoGain.connect(pGain.gain);

          osc.connect(pGain);
          pGain.connect(gainNode);

          lfo.start(now);
          osc.start(now);

          activeNode.synthNodes.push(osc, lfo, pGain, lfoGain);
        });
        break;
      }

      case "cue-4": {
        // GIỚI THIỆU ĐẠI BIỂU (A crisp heartbeat pulse / introduction ticking beat)
        const tickInterval = 0.6; // 100 BPM
        let counter = 0;

        const runTick = () => {
          if (activeNode.isFinished) return;
          const tickTime = this.ctx!.currentTime;
          const osc = this.ctx!.createOscillator();
          const tickGain = this.ctx!.createGain();

          osc.type = counter % 4 === 0 ? "sawtooth" : "triangle";
          osc.frequency.setValueAtTime(counter % 4 === 0 ? 150 : 250, tickTime);

          const filter = this.ctx!.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(400, tickTime);

          tickGain.gain.setValueAtTime(0.3, tickTime);
          tickGain.gain.exponentialRampToValueAtTime(0.001, tickTime + 0.15);

          osc.connect(filter);
          filter.connect(tickGain);
          tickGain.connect(gainNode);

          osc.start(tickTime);
          osc.stop(tickTime + 0.2);

          counter++;
        };

        // Run initial
        runTick();
        activeNode.intervalId = setInterval(runTick, tickInterval * 1000);
        break;
      }

      case "cue-5": {
        // PHÁT BIỂU HIỆU TRƯỞNG (Peaceful electric piano backing chord loop)
        const chords = [
          [130.81, 164.81, 196.0, 246.94], // C major 7 (C3, E3, G3, B3)
          [174.61, 220.0, 261.63, 329.63], // F major 7 (F3, A3, C4, E4)
          [196.00, 246.94, 293.66, 349.23], // G dominant 7 (G3, B3, D4, F4)
        ];

        let chordIndex = 0;
        const playChord = () => {
          if (activeNode.isFinished) return;
          const chordTime = this.ctx!.currentTime;
          const notes = chords[chordIndex];

          notes.forEach((freq, idx) => {
            const osc = this.ctx!.createOscillator();
            const pGain = this.ctx!.createGain();

            osc.type = "sine";
            // Stagger notes slightly for a beautiful plucked arpeggio feel
            osc.frequency.setValueAtTime(freq, chordTime + idx * 0.12);

            pGain.gain.setValueAtTime(0, chordTime);
            pGain.gain.setValueAtTime(0, chordTime + idx * 0.12);
            pGain.gain.linearRampToValueAtTime(0.08, chordTime + idx * 0.12 + 0.2);
            pGain.gain.exponentialRampToValueAtTime(0.001, chordTime + idx * 0.12 + 3.5);

            osc.connect(pGain);
            pGain.connect(gainNode);

            osc.start(chordTime + idx * 0.12);
            osc.stop(chordTime + 5);
          });

          chordIndex = (chordIndex + 1) % chords.length;
        };

        playChord();
        activeNode.intervalId = setInterval(playChord, 5000);
        break;
      }

      case "cue-6": {
        // TIẾT MỤC VĂN NGHỆ (Modern dance electronic beat sequencer)
        const tempo = 0.5; // 120 BPM
        let beat = 0;

        const runSequencer = () => {
          if (activeNode.isFinished) return;
          const bTime = this.ctx!.currentTime;

          // Kick on 1 and 3
          if (beat % 2 === 0) {
            const kick = this.ctx!.createOscillator();
            const kickGain = this.ctx!.createGain();
            kick.frequency.setValueAtTime(150, bTime);
            kick.frequency.exponentialRampToValueAtTime(45, bTime + 0.15);

            kickGain.gain.setValueAtTime(0.4, bTime);
            kickGain.gain.exponentialRampToValueAtTime(0.001, bTime + 0.25);

            kick.connect(kickGain);
            kickGain.connect(gainNode);
            kick.start(bTime);
            kick.stop(bTime + 0.3);
          }

          // Arpeggiated synthesizer baseline
          const bassNotes = [110.0, 130.81, 146.83, 165.0]; // A2, C3, D3, E3
          const bassOsc = this.ctx!.createOscillator();
          const bassGain = this.ctx!.createGain();
          const bassFilter = this.ctx!.createBiquadFilter();

          bassOsc.type = "sawtooth";
          bassOsc.frequency.setValueAtTime(bassNotes[beat % 4], bTime);

          bassFilter.type = "lowpass";
          bassFilter.frequency.setValueAtTime(300, bTime);
          bassFilter.frequency.exponentialRampToValueAtTime(800, bTime + 0.1);

          bassGain.gain.setValueAtTime(0.06, bTime);
          bassGain.gain.exponentialRampToValueAtTime(0.001, bTime + 0.2);

          bassOsc.connect(bassFilter);
          bassFilter.connect(bassGain);
          bassGain.connect(gainNode);

          bassOsc.start(bTime);
          bassOsc.stop(bTime + 0.25);

          beat = (beat + 1) % 8;
        };

        runSequencer();
        activeNode.intervalId = setInterval(runSequencer, tempo * 1000);
        break;
      }

      case "cue-7": {
        // TRAO HOA / KHEN THƯỞNG (Bright joyful fanfare strings & bells)
        const celebrationMelody = [
          { f: 261.63, d: 0.2, t: 0 },    // C4
          { f: 329.63, d: 0.2, t: 0.2 },  // E4
          { f: 392.00, d: 0.2, t: 0.4 },  // G4
          { f: 523.25, d: 0.4, t: 0.6 },  // C5
          { f: 392.00, d: 0.2, t: 1.0 },  // G4
          { f: 523.25, d: 0.6, t: 1.2 },  // C5
        ];

        celebrationMelody.forEach((note) => {
          const osc = this.ctx!.createOscillator();
          const chimeGain = this.ctx!.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(note.f, now + note.t);

          chimeGain.gain.setValueAtTime(0, now);
          chimeGain.gain.setValueAtTime(0, now + note.t);
          chimeGain.gain.linearRampToValueAtTime(0.15, now + note.t + 0.02);
          chimeGain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d * 2);

          osc.connect(chimeGain);
          chimeGain.connect(gainNode);

          osc.start(now + note.t);
          activeNode.synthNodes.push(osc, chimeGain);
        });

        if (activeNode.loop) {
          activeNode.intervalId = setInterval(() => {
            this.playProceduralCue(id, gainNode, activeNode);
          }, 3000);
        }
        break;
      }

      case "cue-8": {
        // TEAM BUILDING (Upbeat fast drum-and-bass techno)
        const fastTempo = 0.18; // ~170 BPM
        let fastStep = 0;

        const runFastSequencer = () => {
          if (activeNode.isFinished) return;
          const fsTime = this.ctx!.currentTime;

          // Heavy Kick on 1 and 5
          if (fastStep % 4 === 0) {
            const kick = this.ctx!.createOscillator();
            const kickGain = this.ctx!.createGain();
            kick.frequency.setValueAtTime(180, fsTime);
            kick.frequency.exponentialRampToValueAtTime(50, fsTime + 0.1);

            kickGain.gain.setValueAtTime(0.5, fsTime);
            kickGain.gain.exponentialRampToValueAtTime(0.001, fsTime + 0.15);

            kick.connect(kickGain);
            kickGain.connect(gainNode);
            kick.start(fsTime);
            kick.stop(fsTime + 0.2);
          }

          // Energetic Synth Pulse
          if (fastStep % 2 !== 0) {
            const synth = this.ctx!.createOscillator();
            const synthGain = this.ctx!.createGain();
            const filter = this.ctx!.createBiquadFilter();

            synth.type = "sawtooth";
            const pitches = [220, 293, 329, 392];
            synth.frequency.setValueAtTime(pitches[fastStep % 4], fsTime);

            filter.type = "bandpass";
            filter.frequency.setValueAtTime(1000, fsTime);

            synthGain.gain.setValueAtTime(0.05, fsTime);
            synthGain.gain.exponentialRampToValueAtTime(0.001, fsTime + 0.12);

            synth.connect(filter);
            filter.connect(synthGain);
            synthGain.connect(gainNode);

            synth.start(fsTime);
            synth.stop(fsTime + 0.15);
          }

          fastStep = (fastStep + 1) % 8;
        };

        runFastSequencer();
        activeNode.intervalId = setInterval(runFastSequencer, fastTempo * 1000);
        break;
      }

      case "cue-9": {
        // CHUYỂN CẢNH / DẪN MC (Slow sweeping riser sweep with white noise)
        const bufferSize = this.ctx.sampleRate * 4; // 4 seconds noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.Q.setValueAtTime(5.0, now);
        // Sweep frequency up from 200 to 2500 Hz
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(2500, now + 3.8);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(0.12, now + 1.5);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);

        noiseNode.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(gainNode);

        noiseNode.start(now);
        activeNode.synthNodes.push(noiseNode, filter, noiseGain);

        if (activeNode.loop) {
          activeNode.intervalId = setInterval(() => {
            this.playProceduralCue(id, gainNode, activeNode);
          }, 4200);
        }
        break;
      }

      case "cue-10": {
        // BẾ MẠC (Grand ending chord sequence - organ and warm chorus)
        const finalFreqs = [196.00, 261.63, 329.63, 392.00, 523.25]; // G3, C4, E4, G4, C5 (Epic C Major Chord)
        finalFreqs.forEach((freq, idx) => {
          const osc1 = this.ctx!.createOscillator();
          const osc2 = this.ctx!.createOscillator();
          const finalGain = this.ctx!.createGain();

          osc1.type = "sine";
          osc2.type = "triangle";

          osc1.frequency.setValueAtTime(freq, now);
          osc2.frequency.setValueAtTime(freq * 1.002, now); // micro detuning

          finalGain.gain.setValueAtTime(0.03, now);

          osc1.connect(finalGain);
          osc2.connect(finalGain);
          finalGain.connect(gainNode);

          osc1.start(now);
          osc2.start(now);

          activeNode.synthNodes.push(osc1, osc2, finalGain);
        });
        break;
      }
    }
  }

  private playProceduralSfx(id: string, gainNode: GainNode, sfxInfo: any) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    switch (id) {
      case "sfx-1": {
        // APPLAUSE 👏 (Filtered white noise bursts mimicking a crowd claps)
        // We simulate a fast repetition of dual claps
        const duration = 10.0;
        const totalClaps = 140;

        for (let i = 0; i < totalClaps; i++) {
          const clapTime = now + Math.random() * duration;
          const osc = this.ctx.createOscillator();
          const pGain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(150 + Math.random() * 80, clapTime);

          filter.type = "bandpass";
          filter.frequency.setValueAtTime(1200 + Math.random() * 600, clapTime);
          filter.Q.setValueAtTime(3.0, clapTime);

          pGain.gain.setValueAtTime(0, now);
          pGain.gain.setValueAtTime(0, clapTime);
          pGain.gain.linearRampToValueAtTime(0.08, clapTime + 0.005);
          pGain.gain.exponentialRampToValueAtTime(0.001, clapTime + 0.08 + Math.random() * 0.06);

          osc.connect(filter);
          filter.connect(pGain);
          pGain.connect(gainNode);

          osc.start(clapTime);
          osc.stop(clapTime + 0.3);
        }

        // Auto disconnect SFX
        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, duration * 1000 + 100);
        break;
      }

      case "sfx-2": {
        // TRỐNG CHÀO MỪNG 🥁 (Snare drum roll crescendos)
        const duration = 3.0;
        const totalSnareHits = 60;

        for (let i = 0; i < totalSnareHits; i++) {
          const hitTime = now + (i / totalSnareHits) * duration;
          // Crescendo effect: louder at the end
          const volumeScale = (i / totalSnareHits) * 0.18 + 0.02;

          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const hitGain = this.ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(180, hitTime);

          filter.type = "bandpass";
          filter.frequency.setValueAtTime(1000, hitTime);
          filter.Q.setValueAtTime(2, hitTime);

          hitGain.gain.setValueAtTime(0, now);
          hitGain.gain.setValueAtTime(0, hitTime);
          hitGain.gain.linearRampToValueAtTime(volumeScale, hitTime + 0.003);
          hitGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.05);

          osc.connect(filter);
          filter.connect(hitGain);
          hitGain.connect(gainNode);

          osc.start(hitTime);
          osc.stop(hitTime + 0.1);
        }

        // Big Bass Drum hit at the end
        const bigHitTime = now + duration;
        const kick = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kick.frequency.setValueAtTime(150, bigHitTime);
        kick.frequency.exponentialRampToValueAtTime(40, bigHitTime + 0.3);

        kickGain.gain.setValueAtTime(0, now);
        kickGain.gain.setValueAtTime(0, bigHitTime);
        kickGain.gain.linearRampToValueAtTime(0.5, bigHitTime + 0.01);
        kickGain.gain.exponentialRampToValueAtTime(0.001, bigHitTime + 0.6);

        kick.connect(kickGain);
        kickGain.connect(gainNode);
        kick.start(bigHitTime);
        kick.stop(bigHitTime + 0.8);

        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, (duration + 1) * 1000);
        break;
      }

      case "sfx-3": {
        // KÈN CHIẾN THẮNG 🎉 (Bright trumpet fanfare chords)
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4-E4-G4-C5
        notes.forEach((freq, idx) => {
          const osc1 = this.ctx!.createOscillator();
          const osc2 = this.ctx!.createOscillator();
          const hornGain = this.ctx!.createGain();

          osc1.type = "sawtooth";
          osc2.type = "triangle";

          // Stagger slightly
          const hitTime = now + idx * 0.05;

          osc1.frequency.setValueAtTime(freq, hitTime);
          osc2.frequency.setValueAtTime(freq * 1.004, hitTime);

          const filter = this.ctx!.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(1500, hitTime);

          hornGain.gain.setValueAtTime(0, now);
          hornGain.gain.setValueAtTime(0, hitTime);
          hornGain.gain.linearRampToValueAtTime(0.12, hitTime + 0.05);
          hornGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 1.8);

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(hornGain);
          hornGain.connect(gainNode);

          osc1.start(hitTime);
          osc2.start(hitTime);
          osc1.stop(hitTime + 2.0);
          osc2.stop(hitTime + 2.0);
        });

        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, 2200);
        break;
      }

      case "sfx-4": {
        // CHUÔNG BÁO 🔔 (Metallic chime bell)
        const frequencies = [587.33, 587.33 * 1.5, 587.33 * 2.2, 587.33 * 2.7]; // FM metallic ratios
        frequencies.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const bellGain = this.ctx!.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);

          bellGain.gain.setValueAtTime(idx === 0 ? 0.3 : 0.08, now);
          bellGain.gain.exponentialRampToValueAtTime(0.001, now + (idx === 0 ? 2.5 : 1.2));

          osc.connect(bellGain);
          bellGain.connect(gainNode);

          osc.start(now);
          osc.stop(now + 3.0);
        });

        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, 3100);
        break;
      }

      case "sfx-5": {
        // CẢNH BÁO ⚠️ (Harsh double warning buzzer)
        const warningTime = 1.0;
        const frequencies = [120, 122];

        frequencies.forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const buzzGain = this.ctx!.createGain();

          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, now);

          // Connect LFO for harsh pitch modulation
          const vibrato = this.ctx!.createOscillator();
          const vibratoGain = this.ctx!.createGain();
          vibrato.frequency.setValueAtTime(12, now); // 12Hz buzz
          vibratoGain.gain.setValueAtTime(15, now);
          vibrato.connect(vibratoGain);
          vibratoGain.connect(osc.frequency);

          buzzGain.gain.setValueAtTime(0.18, now);
          buzzGain.gain.setValueAtTime(0.18, now + 0.35);
          buzzGain.gain.setValueAtTime(0.001, now + 0.4);
          buzzGain.gain.setValueAtTime(0.18, now + 0.5);
          buzzGain.gain.exponentialRampToValueAtTime(0.001, now + warningTime);

          osc.connect(buzzGain);
          buzzGain.connect(gainNode);

          vibrato.start(now);
          osc.start(now);
          osc.stop(now + warningTime + 0.1);
        });

        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, warningTime * 1000 + 100);
        break;
      }

      case "sfx-6": {
        // HỒI HỘP 🤔 (Ominous low-pass tension drone)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const tensionGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = "sawtooth";
        osc2.type = "sawtooth";

        osc1.frequency.setValueAtTime(73.42, now); // D2
        osc2.frequency.setValueAtTime(73.7, now);  // slow beating

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(200, now);
        // Sweep filter slightly
        filter.frequency.linearRampToValueAtTime(320, now + 3.0);

        tensionGain.gain.setValueAtTime(0.2, now);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(tensionGain);
        tensionGain.connect(gainNode);

        osc1.start(now);
        osc2.start(now);

        sfxInfo.source = osc1; // store first to support Stop All

        // Sound loops or runs until stopped, we default to 4 seconds for SFX
        const droneDuration = 4.0;
        tensionGain.gain.setValueAtTime(0.2, now + droneDuration - 0.5);
        tensionGain.gain.exponentialRampToValueAtTime(0.001, now + droneDuration);

        setTimeout(() => {
          try {
            osc1.stop();
            osc2.stop();
          } catch(e){}
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, droneDuration * 1000 + 100);
        break;
      }

      case "sfx-7": {
        // HÀI HƯỚC 🎭 (Cartoon Boing pitch slide)
        const osc = this.ctx.createOscillator();
        const boingGain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(650, now + 0.4);

        boingGain.gain.setValueAtTime(0.35, now);
        boingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        osc.connect(boingGain);
        boingGain.connect(gainNode);

        osc.start(now);
        osc.stop(now + 0.8);

        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, 800);
        break;
      }

      case "sfx-8": {
        // VÚT QUA 💨 (Beautiful stereophonic white noise swoosh)
        const bufferSize = this.ctx.sampleRate * 0.7; // 0.7s swoosh
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.Q.setValueAtTime(6.0, now);
        filter.frequency.setValueAtTime(150, now);
        filter.frequency.exponentialRampToValueAtTime(3000, now + 0.3);
        filter.frequency.exponentialRampToValueAtTime(400, now + 0.7);

        const swooshGain = this.ctx.createGain();
        swooshGain.gain.setValueAtTime(0, now);
        swooshGain.gain.linearRampToValueAtTime(0.28, now + 0.3);
        swooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        source.connect(filter);
        filter.connect(swooshGain);
        swooshGain.connect(gainNode);

        source.start(now);

        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, 800);
        break;
      }

      case "sfx-9": {
        // TIẾT SÉT 💥 (Colossal thunder impact + rumbling tail)
        const duration = 3.5;
        // 1. Initial explosive lightning crackle
        const crackleOsc = this.ctx.createOscillator();
        const crackleGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        crackleOsc.type = "sawtooth";
        crackleOsc.frequency.setValueAtTime(100, now);

        filter.type = "bandpass";
        filter.frequency.setValueAtTime(800, now);

        crackleGain.gain.setValueAtTime(0.35, now);
        crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        crackleOsc.connect(filter);
        filter.connect(crackleGain);
        crackleGain.connect(gainNode);

        crackleOsc.start(now);
        crackleOsc.stop(now + 0.3);

        // 2. Slow rumbling tail
        const rumbleOsc = this.ctx.createOscillator();
        const rumbleGain = this.ctx.createGain();
        const rFilter = this.ctx.createBiquadFilter();

        rumbleOsc.type = "triangle";
        rumbleOsc.frequency.setValueAtTime(65, now);
        // Slowly drop pitch
        rumbleOsc.frequency.linearRampToValueAtTime(40, now + duration);

        rFilter.type = "lowpass";
        rFilter.frequency.setValueAtTime(100, now);

        rumbleGain.gain.setValueAtTime(0, now);
        rumbleGain.gain.setValueAtTime(0, now + 0.02);
        rumbleGain.gain.linearRampToValueAtTime(0.5, now + 0.15);
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        rumbleOsc.connect(rFilter);
        rFilter.connect(rumbleGain);
        rumbleGain.connect(gainNode);

        rumbleOsc.start(now);
        rumbleOsc.stop(now + duration + 0.2);

        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, duration * 1000 + 100);
        break;
      }

      case "sfx-10": {
        // TIẾNG ĐÀN 🎹 (A lovely cascading piano-harp major arpeggio)
        const pitches = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5
        pitches.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const noteGain = this.ctx!.createGain();

          osc.type = "sine";
          const hitTime = now + idx * 0.1;

          osc.frequency.setValueAtTime(freq, hitTime);

          noteGain.gain.setValueAtTime(0, now);
          noteGain.gain.setValueAtTime(0, hitTime);
          noteGain.gain.linearRampToValueAtTime(0.18, hitTime + 0.02);
          noteGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 1.5);

          osc.connect(noteGain);
          noteGain.connect(gainNode);

          osc.start(hitTime);
          osc.stop(hitTime + 2.0);
        });

        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, 2200);
        break;
      }

      case "sfx-11": {
        // KHỞI ĐỘNG 🚀 (Futuristic sci-fi riser build up)
        const riserDuration = 2.2;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const rGain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + riserDuration);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(2000, now + riserDuration);

        rGain.gain.setValueAtTime(0.02, now);
        rGain.gain.linearRampToValueAtTime(0.15, now + riserDuration - 0.2);
        rGain.gain.exponentialRampToValueAtTime(0.001, now + riserDuration);

        osc.connect(filter);
        filter.connect(rGain);
        rGain.connect(gainNode);

        osc.start(now);
        osc.stop(now + riserDuration + 0.1);

        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, riserDuration * 1000 + 100);
        break;
      }

      case "sfx-12": {
        // CÒI TRỌNG TÀI 🛑 (Piercing metallic referee whistle with tremolo)
        const duration = 1.0;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const wGain = this.ctx.createGain();

        osc1.type = "triangle";
        osc2.type = "sine";

        osc1.frequency.setValueAtTime(3000, now);
        osc2.frequency.setValueAtTime(3030, now); // creates a rapid acoustic beating at 30Hz

        // Tremolo
        const tremolo = this.ctx.createOscillator();
        const tremoloGain = this.ctx.createGain();
        tremolo.frequency.setValueAtTime(22, now);
        tremoloGain.gain.setValueAtTime(0.15, now);
        tremolo.connect(tremoloGain);
        tremoloGain.connect(wGain.gain); // modulates overall volume directly

        wGain.gain.setValueAtTime(0.2, now);
        wGain.gain.setValueAtTime(0.2, now + duration - 0.2);
        wGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc1.connect(wGain);
        osc2.connect(wGain);
        wGain.connect(gainNode);

        tremolo.start(now);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration + 0.1);
        osc2.stop(now + duration + 0.1);

        setTimeout(() => {
          gainNode.disconnect();
          this.activeSfxs.delete(id);
          this.triggerUpdate();
        }, duration * 1000 + 100);
        break;
      }
    }
  }
}

export const audioEngine = new AudioEngine();
