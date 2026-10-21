import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import type { ThemePreference } from "../store/uiSettings";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** 設定（auto / light / dark）から、実際に使うテーマを決める */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): "light" | "dark" {
  if (preference === "auto") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** 設定を <html data-theme> に反映する。auto のときは、OS の設定が変わったらすぐ追従する */
export function useThemeEffect() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme, media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

/** ボタンを押すたびに auto → light → dark → auto と切り替える */
export const NEXT_THEME: Record<ThemePreference, ThemePreference> = { auto: "light", light: "dark", dark: "auto" };
export const THEME_LABEL: Record<ThemePreference, string> = { auto: "自動（OSの設定）", light: "ライト", dark: "ダーク" };
