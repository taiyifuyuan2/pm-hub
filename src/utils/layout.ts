/** 左右パネルの幅（px）の範囲と既定値 */
export const PANEL_WIDTH = {
  left: { min: 240, max: 480, default: 300 },
  right: { min: 280, max: 560, default: 340 },
} as const;

/** 中央列（チャット）に最低限残す幅（px）。これより狭いと、タイトルや入力欄が窮屈になる */
export const CENTER_MIN_WIDTH = 420;

/** 範囲に収める。数値でない・NaN の場合は fallback */
export function clampWidth(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * 左右のパネルの幅を、ウィンドウ幅に収まるように調整する。
 * 中央列に CENTER_MIN_WIDTH を確保するため、足りないぶんは左右から削る（それぞれの最小幅までは縮める）。
 * ウィンドウが十分に広ければ、指定された幅をそのまま返す。
 * 左右の表示・非表示（0 幅）にも対応する: 非表示のパネルの幅は 0 として扱う。
 */
export function fitPanelWidths(
  windowWidth: number,
  left: { width: number; visible: boolean },
  right: { width: number; visible: boolean },
): { left: number; right: number } {
  let l = left.visible ? left.width : 0;
  let r = right.visible ? right.width : 0;
  // 境界線の幅（1px × 表示中のパネル数）
  const borders = (left.visible ? 1 : 0) + (right.visible ? 1 : 0);
  let excess = l + r + borders + CENTER_MIN_WIDTH - windowWidth;
  if (excess > 0 && l > 0) {
    const cut = Math.min(excess, l - PANEL_WIDTH.left.min);
    if (cut > 0) {
      l -= cut;
      excess -= cut;
    }
  }
  if (excess > 0 && r > 0) {
    const cut = Math.min(excess, r - PANEL_WIDTH.right.min);
    if (cut > 0) r -= cut;
  }
  return { left: left.visible ? l : left.width, right: right.visible ? r : right.width };
}

/**
 * ウィンドウ幅の中で、片側のパネルが広げられる最大幅（px）。
 * もう片側のパネル（表示中なら）と中央の最小幅を確保した残りを、このパネルに割り当てられる。
 * パネル自身の最大幅（PANEL_WIDTH の max）も超えない。
 */
export function maxPanelWidth(
  side: "left" | "right",
  windowWidth: number,
  other: { width: number; visible: boolean },
): number {
  const own = PANEL_WIDTH[side];
  // 自分の境界線（1px）と、もう片側のパネル + その境界線
  const reserved = 1 + (other.visible ? other.width + 1 : 0) + CENTER_MIN_WIDTH;
  return Math.max(own.min, Math.min(own.max, windowWidth - reserved));
}
