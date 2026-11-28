/* Small shared UI pieces. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronDown, IconMinus, IconPlus } from "./Icons";
import { backdropClose } from "../lib/backdrop";

/** State kept in sessionStorage, so a filter survives switching tabs but not closing the app. */
export function useSessionState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try { const raw = sessionStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV] as const;
}

/** State kept in localStorage (this device only, not synced). */
export function useLocalState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV] as const;
}

export function useMedia(q: string) {
  const [on, setOn] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setOn(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [q]);
  return on;
}

export function Seg<T extends string | number>({ value, options, onChange, label, className }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div className={`seg ${className ?? ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

export function Stepper({ value, onChange, min, max, step, label, unit, format }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; label: string; unit?: string; format?: (v: number) => string }) {
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-ctl">
        <button type="button" aria-label={`Lower ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(round(Math.max(min, value - step)))}><IconMinus /></button>
        <span className="stepper-value" aria-live="polite"><b className="num-static">{format ? format(value) : value}</b>{unit && <span className="unit">{unit}</span>}</span>
        <button type="button" aria-label={`Raise ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(round(Math.min(max, value + step)))}><IconPlus /></button>
      </div>
    </div>
  );
}

/** A labelled field. */
export function Field({ label, hint, children, id }: { label: string; hint?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="muted small">{hint}</span>}
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options, id, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; id?: string; label?: string }) {
  return (
    <span className="select-box">
      <select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <IconChevronDown />
    </span>
  );
}

/** A modal sheet (bottom sheet on phones, centred dialog on wider screens). */
export function Sheet({ title, onClose, children, actions, wide }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    // Focus the field marked data-autofocus, else nothing (rather than a ring on the Done button).
    const af = d?.querySelector<HTMLElement>("[data-autofocus]");
    if (af) af.focus(); else (document.activeElement as HTMLElement | null)?.blur();
    document.documentElement.classList.add("sheet-open");
    return () => document.documentElement.classList.remove("sheet-open");
  }, []);
  return (
    <dialog ref={ref} className={`dlg${wide ? " wide" : ""}`} aria-labelledby="sheet-title" onClose={onClose} {...backdropClose(ref)}>
      <div className="dlg-body">
        <div className="dlg-grip" aria-hidden="true" />
        <div className="card-head">
          <h2 id="sheet-title">{title}</h2>
          {actions ?? <button type="button" className="btn ghost sm" onClick={() => ref.current?.close()}>Done</button>}
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** Close the sheet this element is in (lets the dialog's own close animation and onClose run). */
export const closeSheet = (el: HTMLElement | null) => el?.closest("dialog")?.close();
