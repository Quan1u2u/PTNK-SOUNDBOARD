import { useEffect, useRef, useState } from "react";
import { audioEngine } from "../lib/audioEngine";
import { Sparkles, Activity, BarChart2 } from "lucide-react";

type VisualizerMode = "spectrum" | "waveform" | "radial";

export default function AudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<VisualizerMode>("spectrum");
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize handling relative to container
    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = (rect?.width || 320) * window.devicePixelRatio;
      canvas.height = (rect?.height || 140) * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Clear with very slight transparency to create trailing/motion-blur effect
      ctx.fillStyle = "rgba(5, 10, 24, 0.25)";
      ctx.fillRect(0, 0, width, height);

      const analyser = audioEngine.getAnalyser();
      if (!analyser) {
        // Draw static standby wave if engine not initialized or idle
        ctx.strokeStyle = "rgba(0, 229, 255, 0.2)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.04 + Date.now() * 0.003) * 3;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      if (mode === "waveform") {
        analyser.getByteTimeDomainData(dataArray);

        ctx.strokeStyle = "#00e5ff"; // Cyan Sophisticated Dark Accent
        ctx.lineWidth = 2;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Draw outer glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(0, 229, 255, 0.5)";
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      } else if (mode === "spectrum") {
        analyser.getByteFrequencyData(dataArray);

        const barWidth = (width / bufferLength) * 2.2;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.85;

          // Multi-color elegant gradient from deep cyan to white
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, "#00b2cc"); // deep brand cyan
          gradient.addColorStop(0.5, "#00e5ff"); // brand cyan
          gradient.addColorStop(1, "#e0f7fa"); // white cyan

          ctx.fillStyle = gradient;
          ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

          x += barWidth;
        }
      } else if (mode === "radial") {
        analyser.getByteFrequencyData(dataArray);

        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) * 0.4;

        // Take the low bass average to drive overall pulse
        let bassSum = 0;
        const bassCount = 10;
        for (let i = 0; i < bassCount; i++) {
          bassSum += dataArray[i];
        }
        const bassAvg = bassSum / bassCount;
        const pulseScale = 1 + (bassAvg / 255) * 0.25;

        // Draw pulsing outer rings
        ctx.strokeStyle = "rgba(0, 229, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius * pulseScale * 0.8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(0, 229, 255, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius * pulseScale * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        // Draw frequency lines radiating outwards
        const linesCount = 60;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(0, 229, 255, 0.4)";

        for (let i = 0; i < linesCount; i++) {
          const angle = (i / linesCount) * Math.PI * 2;
          const value = dataArray[Math.floor((i / linesCount) * (bufferLength / 2))];
          const innerRadius = maxRadius * 0.45 * pulseScale;
          const outerRadius = innerRadius + (value / 255) * maxRadius * 0.45;

          const x1 = centerX + Math.cos(angle) * innerRadius;
          const y1 = centerY + Math.sin(angle) * innerRadius;
          const x2 = centerX + Math.cos(angle) * outerRadius;
          const y2 = centerY + Math.sin(angle) * outerRadius;

          ctx.strokeStyle = `hsla(${180 + (value / 255) * 60}, 90%, 65%, ${0.4 + (value / 255) * 0.6})`;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.shadowBlur = 0; // reset
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [mode]);

  return (
    <div className="relative w-full h-full bg-[#050A18]/80 rounded-lg border border-[#1E2E5A] overflow-hidden flex flex-col justify-end" id="audio-visualizer-container">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" id="visualizer-canvas" />

      {/* Mode selectors */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10 bg-[#0D152B]/80 backdrop-blur-md rounded-md p-1 border border-[#1E2E5A]" id="visualizer-mode-picker">
        <button
          onClick={() => setMode("spectrum")}
          className={`p-1 rounded transition-colors ${mode === "spectrum" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}
          title="Dải tần số"
          id="btn-vis-spectrum"
        >
          <BarChart2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setMode("waveform")}
          className={`p-1 rounded transition-colors ${mode === "waveform" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}
          title="Dạng sóng"
          id="btn-vis-waveform"
        >
          <Activity className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setMode("radial")}
          className={`p-1 rounded transition-colors ${mode === "radial" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}
          title="Radar tỏa tròn"
          id="btn-vis-radial"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
