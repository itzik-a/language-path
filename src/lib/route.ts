/* Routing is the URL hash: "#words/w_ja_水" → { view: "words", sub: "w_ja_水" }. */
import { useEffect, useState } from "react";

export type View = "today" | "read" | "talk" | "words" | "review" | "script";
const VIEWS: View[] = ["today", "read", "talk", "words", "review", "script"];

export interface Route { view: View; sub?: string }

export function readHash(): Route {
  const [v, ...rest] = decodeURIComponent(location.hash.slice(1)).split("/");
  const view = VIEWS.includes(v as View) ? (v as View) : "today";
  return { view, sub: rest.join("/") || undefined };
}

export const href = (view: View, sub?: string) => `#${view}${sub ? "/" + encodeURIComponent(sub) : ""}`;
export const go = (view: View, sub?: string) => { location.hash = href(view, sub).slice(1); };

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readHash);
  useEffect(() => {
    const on = () => setRoute((prev) => {
      const next = readHash();
      if (next.view !== prev.view || next.sub !== prev.sub) window.scrollTo(0, 0);
      return next;
    });
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
