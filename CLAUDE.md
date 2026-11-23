# Language Path

My language-learning web app (React, built with Vite, hosted on GitHub Pages), used on a MacBook and an iPhone (installed to the Home Screen), for **Japanese, Polish and Arabic (MSA)**: spaced-repetition cards (FSRS), stories at my level, listening, and conversation practice with Claude. See `PLAN.md` for the research behind it, the concepts, milestones and decisions.

## How it's built

Vite + React 19 + TypeScript. Node 22 (`.nvmrc`). On this Mac `npm start` runs `nvm use` and then the dev server; `npm run dev` alone runs the local server; `npm run build` typechecks and builds into `dist/`; `npm test` runs Vitest (`tests/`).

- Routing is the URL hash (`src/lib/route.ts`): `#today`, `#review`, `#read`, `#read/<text id>`, `#talk`, `#talk/<chat id>`, `#words`, `#words/<word id>`, `#script`, `#script/<kind>`. The active language is per device (`src/lib/prefs.ts`), not in the URL; `<main>` is keyed by view + language.
- `src/types.ts`: the whole saved state (`AppState`): `words`, `cards`, `texts`, `chats`, `days`, `settings` (per language). Every list item has `id` + `updatedAt`; removals are soft (`deletedAt`). Dates are local `YYYY-MM-DD` (`src/lib/dates.ts`).
- Ids: a word's id is `wordKey(lang, lemma)` (`src/lib/langs.ts`; Arabic without harakat, Polish lower-cased), so the same word added on two devices is one word. **Never change a lemma in `src/data/starter.ts`** once shipped.
- `src/state/store.ts`: state in memory, saved to IndexedDB (`idb`, db `languagePath`, key `state`; Safari caps localStorage at ~5 MB), loaded by `initStore()` before the first render; `update(fn)`, `replaceState()`, `useAppState()`. Open tabs stay in step through a BroadcastChannel. `src/state/actions.ts`: every change goes through here and stamps `updatedAt`; Undo toasts.
- Device-only prefs (`src/lib/prefs.ts`, localStorage `languagePath.device`): active language, voice + speed per language, the Claude key and model, a device id, reader toggles.
- Languages (`src/lib/langs.ts`): names, BCP 47 codes, direction, Arabic harakat stripping / folding, kana folding, kanji tests.
- Text in a target language always goes through `src/components/Lx.tsx` (`Term`, `Line`, `TokenText`): sets `lang` / `dir`, furigana from `src/lib/furigana.ts` (over kanji I don't know: `settings.lang.ja.knownKanji`), harakat on/off, transliteration as under-ruby. Sentences are `Token[]` (`src/lib/tokens.ts`); whitespace and punctuation are tokens without a lemma so joining every `t` gives the text back.
- Starter content: `src/data/starter.ts` (words, with a small example markup parsed by `sentence()`), `src/data/seed.ts` (default settings, the first state), `src/data/stories.ts`.
- Voices (`src/lib/speech.ts`): the device's Web Speech voices, best first; one utterance at a time; `speakLines()` reads sentence by sentence. Japanese words are spoken from their kana reading (`sayWord()` in `src/lib/words.ts`) so lone kanji aren't misread.
- Views (`src/views/`): `Today`, `Review`, `Read`, `Talk`, `Words` (list with bulk "I know these", word page), `Script`. Sheets and shared UI in `src/components/` (`ui.tsx`: `Seg`, `Switch`, `Stepper`, `Field`, `Select`, `Sheet`; `SettingsSheet`; `LangSwitch`).
- Styling: plain CSS in `src/styles.css`, tokens in `:root` (the shared system of my apps, teal accent `#0E7490` / dark `#5BC8E0`). Japanese and Arabic get their own font stacks (`.lx-ja`, `.lx-ar`).
- PWA: `public/manifest.webmanifest`, `public/icon.svg`, full-bleed PNG icons in `public/icons/` (rendered from the SVG with headless Chrome + `sips`), `public/sw.js` (production only; network first for the page, cache first for hashed assets; never touches other origins).

## Rules for changes

- Design mobile-first (iPhone ~390 px), tap targets at least 44 px, safe-area padding. Below 768 px: top bar + bottom tab bar (4 tabs); from 768 px a sidebar. Check both widths, light and dark, and all three languages (Arabic is right-to-left; Japanese has furigana).
- Colours only from the CSS tokens in `:root`; light and dark themes must both stay readable.
- New state fields must be optional in `normalize()` so older copies still load.
- Nothing about me leaves the device unencrypted except what a Claude request needs (the text of that job). The Claude key stays on the device.
- Run `npm test` and `npm run build` after edits; both must pass.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main` (Pages source = GitHub Actions). Live at https://itzik-a.github.io/language-path/.
