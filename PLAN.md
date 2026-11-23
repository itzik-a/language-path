# Language Path: plan

My language-learning app for **Japanese, Polish and Arabic (MSA)**, aimed at listening, conversation and reading. It installs on the iPhone Home Screen and runs in the browser on the MacBook, works offline, and syncs through an encrypted private gist. Claude (my own key, on the device) writes stories at my level, explains words, and is my conversation partner.

## 1. What the research says, and what the app does with it

| Technique | Evidence | In the app |
|---|---|---|
| Spaced repetition | Strong: spacing beats massed study for L2 vocabulary (Kim & Webb 2022 meta-analysis, small-to-medium effect) | **FSRS-6** (`ts-fsrs`), 90% target recall, a daily cap on new words so reviews stay ~15 min |
| Retrieval practice | Strong: recalling beats re-reading, when recall mostly succeeds | Every card asks first, shows second; I grade myself (Again / Hard / Good / Easy) |
| Comprehensible input | Strong: reading on your own needs ~95–98% known words; incidental learning is real but slow | Stories written for me from my own known-word list, with a few new words each, shown before I read |
| Nation's four strands | The standard course-design framework | Today balances input (listen/read), output (talk), focused study (cards) and fluency (re-listening to easy stories faster) |
| Output + corrective feedback | Good: corrections help; immediate vs delayed makes no difference to gains, learners like immediate | Talk with Claude; each of my lines gets a quiet correction; mistakes become cards |
| Words in context, with audio | Good | Cards carry an example sentence and audio; words added from texts also get a cloze card |
| Perception training (HVPT) | Strong for sounds my languages lack | Minimal-pair listening (Japanese long vowels / double consonants, Polish sz/ś/ł, Arabic emphatics and throat letters) |
| Shadowing, dictation | Moderate | In the reader: repeat a sentence after the voice and hear both; type what you hear |
| Frequency first | Strong: the top ~2,000 words cover most of everyday text | Starter words are the most common ones; Claude adds the next most frequent words I don't have |

Skipped on purpose: learning styles, translation drills of tiny sentences, heavy gamification, unlimited new cards, immersion in material I can't follow.

## 2. My languages

| | Japanese | Polish | Arabic (MSA) |
|---|---|---|---|
| Where I start | Some hiragana / katakana, ~300 kanji | ~35 words (kobieta, chłopcy, jabłka…) | From zero |
| Script | Kana trainer; my known kanji pasted in once; furigana only over kanji I don't know | Latin + ą ę ł ś ź ż ć ń; sounds page (cz, sz, rz…) | Alphabet trainer with each letter's four forms and its Hebrew counterpart; vowel marks (harakat) on by default |
| Typing | Romaji is turned into kana as I type | Missing diacritics accepted as "almost" | Optional; cards are graded by saying the answer |
| Extras | | Case endings shown in word notes | Root and Hebrew cognate on words (كتب ↔ כתב), right-to-left layout |
| Voice | iPhone/Mac Japanese voice (single words read from their kana, so kanji aren't misread) | Polish voice | Arabic voice, fed vowelled text |

## 3. Concepts

| Thing | What it is |
|---|---|
| **Word** | A dictionary form in one language: reading, transliteration, meaning, notes (root, Hebrew cognate, mnemonic), an example sentence. Status: *new* (queued) → *learning* (has cards) → *known*; or *ignored*. Its id is the language + lemma, so two devices adding the same word get one word. |
| **Card** | One way to practise a word or a character, with its own FSRS state and review log: **recognise** (see → meaning), **listen** (hear → meaning), **say** (meaning → word, added once recognition is solid), **cloze** (a sentence with the word missing), **script** (a kana or letter). Two cards of the same word never come the same day. |
| **Text** | A story or a pasted text, split into sentences of tokens (surface, lemma, reading, meaning in context), with a translation per sentence. Tap a word to see it or add it. |
| **Chat** | A conversation with Claude in a scenario (café, introducing myself, directions…), at my level, with corrections and an end-of-chat review. |
| **Day log** | Per day, language and device: reviews, new words, minutes of reading/listening, chat turns. Feeds the streak and progress. |

## 4. Screens

Tabs: **Today · Read · Talk · Words**. The active language is a switch at the top (あ · Pl · ع).

- **Today**: the four strands for the active language with today's progress: reviews due (start), the next story, a conversation, a fluency re-listen; the script trainer while the script isn't learned; streak and minutes this week.
- **Review**: one card at a time, audio first, four grade buttons showing the next interval.
- **Read**: my texts (new / read), *Write me a story* (topic, length), *Paste a text*; the reader: tap a word, play sentence by sentence with the line highlighted, speed, listen-first (text hidden), translation per line, shadow (record and compare), dictation.
- **Talk**: scenarios and past chats; the chat with voice in (speech recognition or the keyboard's dictation) and out (the voice reads each reply), tap any word, corrections, and *Finish* for a review that turns mistakes into cards.
- **Words**: search, filter by status, add a word; a word's page with its cards and their next dates; scripts (kana, alphabet, known kanji, Polish sounds, minimal pairs); stats (reviews per day, recall rate, due forecast).
- **Settings** (from the top bar): sync, Claude key and model, per-language settings (new words a day, level description, furigana, harakat, transliteration, voice and speed), backup.

## 5. Storage, sync, Claude

- **On the device**: IndexedDB (localStorage is capped at ~5 MB on Safari), one state object kept in memory. Voice choice, active language and the Claude key are per device.
- **Sync**: one private gist file, gzip-compressed then encrypted (AES-256-GCM, PBKDF2 key from a passphrase per device), the finance-path pattern. Merge per item by `updatedAt`; card review logs are unioned. Backups are encrypted the same way.
- **Claude**: called from the browser with my key (kept only on that device), via the official SDK with structured outputs. Default model Claude Opus 5.5 (changeable in settings), low effort for chat and lookups, server-side fallback on. Jobs: write a story at my level, annotate a pasted text, explain a word, suggest the next words to learn, play a conversation partner, review a chat. Nothing is sent to Claude except the text of that job (my known-word list for stories).

## 6. Milestones

1. **Scaffold**: plan, CLAUDE.md, PWA, Pages deploy, IndexedDB store, the three languages, voices, the shell with the language switch, starter words.
2. **Scripts**: hiragana and katakana, the Arabic alphabet and harakat (with Hebrew counterparts), known-kanji import, romaji → kana, Polish sounds, minimal-pair listening.
3. **Cards**: FSRS scheduling, the five card kinds, the review screen, sibling burying, new words a day, Words list and word page, stats.
4. **Reader & listening**: annotated texts, tap-a-word, furigana for unknown kanji, harakat / transliteration, sentence-by-sentence audio with highlight, speed, listen-first, shadowing, dictation, a starter story per language.
5. **Sync & backup**: encrypted, compressed gist sync; encrypted backup file.
6. **Claude**: key and model, stories at my level (known-word coverage), paste-and-annotate, explain a word, next words to learn.
7. **Talk**: scenarios, chat with corrections, voice in and out, end-of-chat review → cards.
8. **Today & progress**: the four-strand day, minutes and streak, progress charts.

## 7. Decisions (2026-11-23)

- Three languages, all beginners; goals: listening, conversation, reading.
- Arabic: MSA everywhere (matches the built-in voices); a spoken dialect can come later as a setting.
- Claude key on the device (added at the end); standalone app, not part of knowledge-path.
- Public repo `itzik-a/language-path` for free GitHub Pages; my learning data never goes in the repo.
