/* Small stroke icons, 24px grid, drawn in currentColor. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true, ...p,
});

export const IconToday = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>
);
export const IconRead = (p: P) => (
  <svg {...base(p)}><path d="M12 6.5C10 5 7.5 4.5 4 4.5v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-14c-3.5 0-6 .5-8 2Z" /><path d="M12 6.5v14" /></svg>
);
export const IconTalk = (p: P) => (
  <svg {...base(p)}><path d="M4 5.5h11a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H9l-4 3.5V15H4a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z" transform="translate(1 0)" /><path d="M18 9h1.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2H19V21l-3-2.5h-3.5a2 2 0 0 1-1.7-1" /></svg>
);
export const IconWords = (p: P) => (
  <svg {...base(p)}><rect x="3" y="7" width="13" height="13" rx="2.5" /><path d="M7 4h11a3 3 0 0 1 3 3v11" /><path d="M7 15.5 9.5 10l2.5 5.5M7.8 13.8h3.4" /></svg>
);
export const IconPlay = (p: P) => (
  <svg {...base(p)}><path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.5-7.2a.8.8 0 0 0 0-1.4L8.2 4.1A.8.8 0 0 0 7 4.8Z" fill="currentColor" stroke="none" /></svg>
);
export const IconStop = (p: P) => (
  <svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" /></svg>
);
export const IconSpeaker = (p: P) => (
  <svg {...base(p)}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>
);
export const IconMic = (p: P) => (
  <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
);
export const IconRecord = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="6.5" fill="currentColor" stroke="none" /></svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base({ width: 16, height: 16, strokeWidth: 2.2, ...p })}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconBack = (p: P) => (
  <svg {...base({ width: 20, height: 20, strokeWidth: 2.2, ...p })}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconNext = (p: P) => (
  <svg {...base({ width: 20, height: 20, strokeWidth: 2.2, ...p })}><path d="M9 5l7 7-7 7" /></svg>
);
export const IconChevronDown = (p: P) => (
  <svg {...base({ width: 16, height: 16, strokeWidth: 2.2, ...p })}><path d="M6 9l6 6 6-6" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base({ width: 18, height: 18, strokeWidth: 2.2, ...p })}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMinus = (p: P) => (
  <svg {...base({ width: 18, height: 18, strokeWidth: 2.2, ...p })}><path d="M5 12h14" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base({ width: 14, height: 14, strokeWidth: 2.6, ...p })}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconExternal = (p: P) => (
  <svg {...base({ width: 14, height: 14, strokeWidth: 2, ...p })}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconLock = (p: P) => (
  <svg {...base({ width: 14, height: 14, strokeWidth: 2, ...p })}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const IconEdit = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" /></svg>
);
export const IconEye = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1-5.1-1.9 5.1-1.9L12 3.5Z" /><path d="M18.5 16v4M16.5 18h4" /></svg>
);
export const IconFlame = (p: P) => (
  <svg {...base({ width: 16, height: 16, ...p })}><path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.3 3.8-8.3.4 2 1.5 3.2 2.7 3.6.4-2.6 1.8-5.1 4.3-6.6-.5 3.3 3.2 5.6 3.2 10.6 0 4-3 6.9-7.5 6.9Z" /></svg>
);
export const IconTranslate = (p: P) => (
  <svg {...base({ width: 18, height: 18, ...p })}><path d="M3.5 6h9M8 4v2c0 4-2 7-4.5 8.5M5.5 9.5c1 2.2 3 4 5.5 5" /><path d="M13 20l3.8-9 3.7 9M14.3 17h5" /></svg>
);
