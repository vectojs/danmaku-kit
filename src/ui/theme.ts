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
  /**
   * Focus-ring color for every keyboard-reachable control.
   *
   * Kept separate from {@link accent} so a theme can make focus louder than its
   * ordinary emphasis color; a ring has to win against whatever it sits on.
   */
  focusRing: string;
  /** Background of an unselected row in an open dropdown menu. */
  menuSurface: string;
  /** Background of the selected row in an open dropdown menu. */
  menuSelected: string;
  /**
   * Background of the keyboard-highlighted row. Should read as stronger than
   * {@link menuSelected}, since both apply at once to a highlighted selection.
   */
  menuHighlight: string;
  /**
   * Fill for the already-downloaded span of a media scrubber.
   *
   * Must read as a third step between the empty track and {@link signal}
   * progress: louder than the track so buffered-versus-empty is legible at a
   * glance, quieter than progress so it never competes with the playhead.
   */
  bufferedTrack: string;
  /**
   * Row height of every command-deck control, in logical pixels. Container
   * geometry derives from it rather than from independent constants: the
   * desktop bar height, the compact card's two rows, and the elapsed label's
   * vertical centering all scale with this value.
   *
   * Optional; the historical 40px row applies when omitted, so existing themes
   * render byte-identically. Values below the 24px readability floor are
   * clamped up. The status bar keeps its own two-line geometry on purpose: its
   * heights never derived from the deck's row constant, so one token silently
   * resizing another surface would be surprising coupling, not convenience.
   */
  readonly controlHeight?: number;
  /**
   * Paint status pills as a neutral outline with a small colored state dot
   * inside, instead of stroking the pill outline (and the bar underline) with
   * the state color. The color still changes per state - it just concentrates
   * into a glanceable dot, which lets a theme keep success/warning saturated
   * without colored chrome everywhere.
   *
   * Optional; the historical color-stroked pill applies when omitted. Forced
   * colors always paint with system colors regardless of this flag.
   */
  readonly statusDot?: boolean;
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
  focusRing: '#60a5fa',
  menuSurface: 'rgba(15, 23, 42, 0.98)',
  menuSelected: 'rgba(96, 165, 250, 0.22)',
  menuHighlight: 'rgba(96, 165, 250, 0.4)',
  bufferedTrack: 'rgba(148, 163, 184, 0.55)',
  radius: 14,
  fontUi: "500 13px 'Inter', system-ui, sans-serif",
  fontLabel: "600 11px 'Inter', system-ui, sans-serif",
  fontDisplay: "600 14px 'Inter', system-ui, sans-serif",
  fontMono: "500 11px 'JetBrains Mono', monospace",
});
