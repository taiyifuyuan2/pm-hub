/** カテゴリの色の数。index.css の --cat-1 ～ --cat-8 に対応する */
export const CATEGORY_COLOR_COUNT = 8;
/** 未分類など、色を付けないカテゴリに使う（index.css の --cat-0。ニュートラルなグレー） */
export const NEUTRAL_CATEGORY = "未分類";

/**
 * カテゴリ名から、色の番号（1 ～ CATEGORY_COLOR_COUNT）を決める。
 * 同じ名前は常に同じ色になり、名前を変えない限り再起動しても変わらない。「未分類」は 0（グレー）。
 */
export function categoryColorIndex(category: string): number {
  const name = category.trim();
  if (!name || name === NEUTRAL_CATEGORY) return 0;
  let hash = 5381;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) + hash + name.charCodeAt(i)) >>> 0;
  return (hash % CATEGORY_COLOR_COUNT) + 1;
}

/** カテゴリの色を CSS 変数として参照する（style 属性に `--cat` として渡し、クラス側で var(--cat) を使う） */
export const categoryColorVar = (category: string) => `var(--cat-${categoryColorIndex(category)})`;
