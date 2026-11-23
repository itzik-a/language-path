import { useState, type ComponentType, type SVGProps } from "react";
import { IconRead, IconSettings, IconTalk, IconToday, IconWords } from "./components/Icons";
import { LangSwitch } from "./components/LangSwitch";
import { SettingsSheet } from "./components/SettingsSheet";
import { DataPill, dotClass } from "./components/SyncSection";
import { useSyncStatus } from "./state/sync";
import { Toast } from "./components/Toast";
import { useLang } from "./lib/prefs";
import { href, useRoute, type View } from "./lib/route";
import { Read } from "./views/Read";
import { Review } from "./views/Review";
import { Script } from "./views/Script";
import { Talk } from "./views/Talk";
import { Today } from "./views/Today";
import { Words } from "./views/Words";

const TABS: { id: View; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "today", label: "Today", Icon: IconToday },
  { id: "read", label: "Read", Icon: IconRead },
  { id: "talk", label: "Talk", Icon: IconTalk },
  { id: "words", label: "Words", Icon: IconWords },
];

/** Which tab a view belongs to (review and script live under Today / Words). */
const tabOf = (v: View): View => (v === "review" ? "today" : v === "script" ? "words" : v);

export function App() {
  const { view, sub } = useRoute();
  const lang = useLang();
  const [settings, setSettings] = useState(false);
  const sync = useSyncStatus();
  const tab = tabOf(view);
  const full = view === "review";

  return (
    <div className={`shell${full ? " full" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="#today" aria-label="Language Path, today">
          <img src="./icon.svg" alt="" width={30} height={30} />
          <span>Language Path</span>
        </a>
        <LangSwitch />
        <nav className="side-nav" aria-label="Sections">
          {TABS.map(({ id, label, Icon }) => (
            <a key={id} href={href(id)} aria-current={tab === id ? "page" : undefined}><Icon /><span>{label}</span></a>
          ))}
        </nav>
        <div className="side-foot">
          <DataPill onOpen={() => setSettings(true)} />
          <button type="button" className="side-settings" onClick={() => setSettings(true)}><IconSettings /><span>Settings</span></button>
        </div>
      </aside>

      <header className="topbar">
        <LangSwitch compact />
        <button type="button" className="icon-btn subtle gear" aria-label={`Settings · sync: ${sync.text}`} onClick={() => setSettings(true)}>
          <IconSettings />{sync.kind !== "off" && <span className={`dot ${dotClass(sync)}`} />}
        </button>
      </header>

      <main className={`main view-${view} lang-${lang}`} key={`${view}/${sub ?? ""}/${lang}`}>
        {view === "today" ? <Today lang={lang} />
          : view === "review" ? <Review lang={lang} sub={sub} />
          : view === "read" ? <Read lang={lang} sub={sub} />
          : view === "talk" ? <Talk lang={lang} sub={sub} />
          : view === "script" ? <Script lang={lang} sub={sub} />
          : <Words lang={lang} sub={sub} />}
      </main>

      <Toast />
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}

      {!full && (
        <nav className="tabbar" aria-label="Sections">
          {TABS.map(({ id, label, Icon }) => (
            <a key={id} href={href(id)} aria-current={tab === id ? "page" : undefined}><Icon /><span>{label}</span></a>
          ))}
        </nav>
      )}
    </div>
  );
}
