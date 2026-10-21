import type { SVGProps } from "react";

/** 24x24 の線画アイコン。絵文字だと環境によって見た目が変わるため、同じ線の太さで統一する */
const PATHS = {
  sun: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z",
  monitor: "M3 5h18v11H3zM8 20h8M12 16v4",
  refresh: "M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-5-5",
  plus: "M12 5v14M5 12h14",
  pin: "M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6ZM12 15v6",
  check: "M5 12.5 10 17.5 19 7",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 6 6 6-6 6",
  chevronLeft: "m15 6-6 6 6 6",
  x: "M6 6l12 12M18 6 6 18",
  inbox: "M3 13l3-8h12l3 8v6H3v-6ZM3 13h5l1 3h6l1-3h5",
  copy: "M9 9h11v11H9zM5 15V4h11",
  panelLeft: "M3 5h18v14H3zM9 5v14",
  panelRight: "M3 5h18v14H3zM15 5v14",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  send: "M5 12 20 5l-4 15-4-6-7-2ZM12 14l8-9",
  stop: "M7 7h10v10H7z",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 8v4l3 2",
  alert: "M12 4 2.5 20h19L12 4ZM12 10v4M12 17h.01",
  info: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 11v5M12 8h.01",
  folder: "M3 6h6l2 2h10v11H3z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  grip: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
  slack: "M5 10h4V6a2 2 0 1 0-4 0v4ZM10 5h4a2 2 0 1 1 0 4h-4V5ZM14 14h4a2 2 0 1 1 0 4h-4v-4ZM10 14v4a2 2 0 1 1-4 0v-4h4Z",
  chat: "M4 5h16v11H9l-5 4V5Z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  note: "M6 3h9l4 4v14H6V3ZM14 3v5h5M9 13h7M9 17h5",
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
