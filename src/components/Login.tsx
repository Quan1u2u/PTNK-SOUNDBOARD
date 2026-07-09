import { useState, FormEvent } from "react";
import { Lock, User, Eye, EyeOff, ShieldAlert } from "lucide-react";

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Add a tiny realistic delay for verification feel
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (username === "admin" && password === "PTNK123") {
      onLoginSuccess();
    } else {
      setError("Sai tên đăng nhập hoặc mật khẩu!");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050A18] flex flex-col items-center justify-center select-none" id="login-screen">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-radial-gradient from-[#0D152B]/30 via-transparent to-transparent opacity-80 pointer-events-none" />

      <div className="relative max-w-md w-full mx-4 z-10" id="login-card-container">
        {/* Subtle decorative futuristic corner borders */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#00E5FF]" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#00E5FF]" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#00E5FF]" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#00E5FF]" />

        <div className="bg-[#0D152B]/95 border border-[#1E2E5A] rounded-xl p-8 shadow-[0_0_30px_rgba(13,21,43,0.8)] backdrop-blur-md" id="login-card">
          {/* Logo / Title Block */}
          <div className="flex flex-col items-center text-center mb-8" id="login-header">
            <div className="w-14 h-14 bg-[#00E5FF] text-[#050A18] rounded-md flex items-center justify-center font-black text-xl tracking-tighter uppercase italic mb-4 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
              PTNK
            </div>
            <h1 className="text-white font-black text-lg tracking-wider uppercase">
              PTNK PLAYBACK SYSTEM
            </h1>
            <span className="text-[#00E5FF] font-mono text-[9px] tracking-widest uppercase mt-1 leading-none font-bold">
              HỆ THỐNG ĐIỀU KHIỂN ÂM THANH CHUYÊN DỤNG
            </span>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3.5 rounded-lg text-xs flex items-center gap-2.5" id="login-error-msg">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="space-y-1.5" id="username-field-container">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập..."
                  className="w-full bg-[#111B35] border border-[#1E2E5A] text-white placeholder-slate-550 text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] transition-all"
                  id="login-username-input"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1.5" id="password-field-container">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full bg-[#111B35] border border-[#1E2E5A] text-white placeholder-slate-550 text-sm rounded-lg pl-10 pr-10 py-2.5 outline-none focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] transition-all"
                  id="login-password-input"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-350 cursor-pointer"
                  id="btn-toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#050A18] font-bold text-xs uppercase tracking-widest py-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
              id="btn-login-submit"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-[#050A18] border-t-transparent rounded-full animate-spin" />
              ) : (
                "ĐĂNG NHẬP HỆ THỐNG"
              )}
            </button>
          </form>

          {/* Footer warning */}
          <div className="mt-8 pt-5 border-t border-[#1E2E5A]/55 text-center" id="login-footer">
            <p className="text-[10px] text-slate-500 leading-relaxed max-w-[280px] mx-auto">
              Hệ thống chuyên dụng cho Ban Tổ Chức Sự Kiện PTNK. Vui lòng đăng nhập bằng tài khoản được cấp để tiếp tục vận hành.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
