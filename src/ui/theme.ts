export interface DanmakuKitTheme {
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  signal: string;
  warning: string;
  danger: string;
  success: string;
  radius: number;
  fontUi: string;
  fontLabel: string;
  fontDisplay: string;
  fontMono: string;
}

export const DEFAULT_DANMAKU_KIT_THEME: Readonly<DanmakuKitTheme> = Object.freeze({
  surface: 'rgba(15, 23, 42, 0.86)',
  surfaceRaised: 'rgba(15, 23, 42, 0.96)',
  border: 'rgba(148, 163, 184, 0.24)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#f43f5e',
  accentHover: '#e11d48',
  signal: '#60a5fa',
  warning: '#fbbf24',
  danger: '#fb7185',
  success: '#34d399',
  radius: 14,
  fontUi: "500 13px 'Inter', system-ui, sans-serif",
  fontLabel: "600 11px 'Inter', system-ui, sans-serif",
  fontDisplay: "600 14px 'Inter', system-ui, sans-serif",
  fontMono: "500 11px 'JetBrains Mono', monospace",
});
