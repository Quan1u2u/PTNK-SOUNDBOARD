export interface AudioFileConfig {
  id: string; // "cue-1" to "cue-10" or "sfx-1" to "sfx-12"
  title: string;
  subtitle?: string;
  emoji?: string;
  hotkey: string;
  isCustom: boolean;
  fileName?: string;
  volume: number; // 0 to 1
  loop?: boolean;
}

export interface PtnkEventProfile {
  id: string;
  name: string;
  description: string;
  cues: AudioFileConfig[];
  sfxs: AudioFileConfig[];
}

export interface PlaybackState {
  currentCueId: string | null;
  isPlaying: boolean;
  isDucked: boolean;
  masterVolume: number; // 0 to 1
  crossfadeTime: number; // in seconds, 0 to 5
  fadeInTime: number; // in seconds, 0 to 3
  fadeOutTime: number; // in seconds, 0 to 3
  elapsedTime: number; // in seconds
  duration: number; // in seconds
}

export const DEFAULT_CUE_PRESETS: Omit<AudioFileConfig, "volume">[] = [
  { id: "cue-1", title: "NHẠC CHỜ", subtitle: "Nhạc đón tiếp đại biểu, phụ huynh & học sinh", hotkey: "1", isCustom: false, loop: true },
  { id: "cue-2", title: "QUỐC CA", subtitle: "Quốc ca trang nghiêm làm lễ chào cờ", hotkey: "2", isCustom: false, loop: false },
  { id: "cue-3", title: "ĐOÀN CA", subtitle: "Đoàn ca trang nghiêm làm lễ chào cờ", hotkey: "3", isCustom: false, loop: false },
  { id: "cue-4", title: "GIỚI THIỆU ĐẠI BIỂU", subtitle: "Nhạc đệm chào mừng ban giám hiệu, khách mời", hotkey: "4", isCustom: false, loop: true },
  { id: "cue-5", title: "MC MỞ MÀN", subtitle: "Nhạc chào mừng MC bước ra sân khấu", hotkey: "5", isCustom: false, loop: true },
  { id: "cue-6", title: "VIP LÊN SÂN KHẤU", subtitle: "Nhạc chào đón đại biểu cấp cao phát biểu", hotkey: "6", isCustom: false, loop: true },
  { id: "cue-7", title: "TRAO HOA / KHEN THƯỞNG", subtitle: "Nhạc vinh danh, trao hoa và phần thưởng", hotkey: "7", isCustom: false, loop: true },
  { id: "cue-8", title: "BẾ MẠC", subtitle: "Nhạc kết thúc và chào tạm biệt buổi lễ", hotkey: "8", isCustom: false, loop: true },
  { id: "cue-9", title: "VIP VÀO HT", subtitle: "Nhạc chào mừng đại biểu tiến vào hội trường", hotkey: "9", isCustom: false, loop: true },
  { id: "cue-10", title: "TRI ÂN", subtitle: "Nhạc tri ân thầy cô ấm áp và lắng đọng", hotkey: "0", isCustom: false, loop: true },
  { id: "cue-11", title: "NHẠC SÔI ĐỘNG 1", subtitle: "Nhạc nền tiết tấu nhanh, sôi động phần hội", hotkey: "Q", isCustom: false, loop: true },
  { id: "cue-12", title: "NHẠC SÔI ĐỘNG 2", subtitle: "Nhạc nền vui tươi, náo nhiệt cho không khí sôi động", hotkey: "W", isCustom: false, loop: true },
  { id: "cue-13", title: "NHẠC CẢM XÚC 1", subtitle: "Nhạc nền sâu lắng, nhẹ nhàng đệm phát biểu", hotkey: "E", isCustom: false, loop: true },
  { id: "cue-14", title: "NHẠC CẢM XÚC 2", subtitle: "Nhạc nền xúc động, ý nghĩa chia sẻ tâm tư", hotkey: "R", isCustom: false, loop: true },
  { id: "cue-15", title: "TEAM BUILDING 1", subtitle: "Nhạc trò chơi tập thể sôi nổi kịch tính", hotkey: "T", isCustom: false, loop: true },
  { id: "cue-16", title: "TEAM BUILDING 2", subtitle: "Nhạc nền hoạt động tập thể hào hứng", hotkey: "Y", isCustom: false, loop: true },
  { id: "cue-17", title: "VĂN NGHỆ 1", subtitle: "Nhạc đệm biểu diễn văn nghệ tiết mục 1", hotkey: "U", isCustom: false, loop: false },
  { id: "cue-18", title: "VĂN NGHỆ 2", subtitle: "Nhạc đệm biểu diễn văn nghệ tiết mục 2", hotkey: "I", isCustom: false, loop: false },
  { id: "cue-19", title: "VĂN NGHỆ 3", subtitle: "Nhạc đệm biểu diễn văn nghệ tiết mục 3", hotkey: "O", isCustom: false, loop: false },
  { id: "cue-20", title: "VĂN NGHỆ 4", subtitle: "Nhạc đệm biểu diễn văn nghệ tiết mục 4", hotkey: "P", isCustom: false, loop: false },
];

export const DEFAULT_SFX_PRESETS: Omit<AudioFileConfig, "volume">[] = [
  { id: "sfx-1", title: "VỖ TAY", emoji: "👏", hotkey: "Z", isCustom: false, loop: false },
  { id: "sfx-2", title: "TRỐNG CHÀO MỪNG", emoji: "🥁", hotkey: "X", isCustom: false, loop: false },
  { id: "sfx-3", title: "KÈN CHIẾN THẮNG", emoji: "🎉", hotkey: "C", isCustom: false, loop: false },
  { id: "sfx-4", title: "CHUÔNG BÁO", emoji: "🔔", hotkey: "V", isCustom: false, loop: false },
  { id: "sfx-5", title: "CẢNH BÁO", emoji: "⚠️", hotkey: "B", isCustom: false, loop: false },
  { id: "sfx-6", title: "HỒI HỘP", emoji: "🤔", hotkey: "N", isCustom: false, loop: true },
  { id: "sfx-7", title: "HÀI HƯỚC", emoji: "🎭", hotkey: "M", isCustom: false, loop: false },
  { id: "sfx-8", title: "VÚT QUA", emoji: "💨", hotkey: ",", isCustom: false, loop: false },
  { id: "sfx-9", title: "TIẾNG SÉT", emoji: "💥", hotkey: ".", isCustom: false, loop: false },
  { id: "sfx-10", title: "TIẾNG ĐÀN", emoji: "🎹", hotkey: "/", isCustom: false, loop: false },
  { id: "sfx-11", title: "KHỞI ĐỘNG", emoji: "🚀", hotkey: "A", isCustom: false, loop: false },
  { id: "sfx-12", title: "CÒI TRỌNG TÀI", emoji: "🛑", hotkey: "S", isCustom: false, loop: false },
];

// No multi-event lists as requested
