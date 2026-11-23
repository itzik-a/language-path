/* Starter stories, one per language, written from the starter words plus a few new ones.
   Same markup as src/data/starter.ts. Never change an id once shipped. */
import { sentence } from "../lib/tokens";
import type { Lang, Text } from "../types";

const STORIES: { id: string; lang: Lang; title: string; titleTr: string; newWords: string[]; lines: [string, string][] }[] = [
  {
    id: "t_seed_ja_neko", lang: "ja", title: "駅の猫", titleTr: "The station cat", newWords: ["かわいい", "言う", "会う"],
    lines: [
      ["私|=|I|わたし は|=|(topic)|は 毎日|=|every day|まいにち 駅|=|station|えき に|=|to|に 行きます|行く|go|いきます 。", "I go to the station every day."],
      ["駅|=|station|えき に|=|at|に 小さい|=|small|ちいさい 猫|=|cat|ねこ が|=|(subject)|が います|いる|there is|います 。", "There is a small cat at the station."],
      ["猫|=|cat|ねこ は|=|(topic)|は 水|=|water|みず を|=|(object)|を 飲みます|飲む|drinks|のみます 。", "The cat drinks water."],
      ["私|=|I|わたし は|=|(topic)|は 猫|=|cat|ねこ が|=|(subject)|が 好き|=|like|すき です|=|(polite)|です 。", "I like cats."],
      ["今日|=|today|きょう 、 友達|=|friend|ともだち と|=|with|と 猫|=|cat|ねこ を|=|(object)|を 見ました|見る|saw|みました 。", "Today I saw the cat with a friend."],
      ["友達|=|friend|ともだち は|=|(topic)|は 「 かわいい|=|cute|かわいい ！ 」 と|=|(quote)|と 言いました|言う|said|いいました 。", "My friend said, \"Cute!\""],
      ["明日|=|tomorrow|あした も|=|also|も 猫|=|cat|ねこ に|=|(to)|に 会いたい|会う|want to meet|あいたい です|=|(polite)|です 。", "I want to see the cat tomorrow too."],
    ],
  },
  {
    id: "t_seed_pl_kot", lang: "pl", title: "Kot Anny", titleTr: "Anna's cat", newWords: ["rano", "praca", "spać", "wracać", "szczęśliwy", "wieczór"],
    lines: [
      ["To|ten|this jest|być|is Anna|-|Anna .", "This is Anna."],
      ["Anna|-|Anna ma|mieć|has małego|mały|small (acc.) kota|kot|cat (acc.) .", "Anna has a small cat."],
      ["Rano|rano|in the morning Anna|-|Anna pije|pić|drinks kawę|kawa|coffee (acc.) , a|=|and kot|=|the cat pije|pić|drinks mleko|=|milk .", "In the morning Anna drinks coffee, and the cat drinks milk."],
      ["Potem|potem|then Anna|-|Anna idzie|iść|goes do|=|to pracy|praca|work (gen.) .", "Then Anna goes to work."],
      ["Kot|=|the cat jest|być|is sam|=|alone w|=|in domu|dom|the house (loc.) .", "The cat is alone at home."],
      ["Kot|=|the cat śpi|spać|sleeps cały|=|the whole dzień|=|day .", "The cat sleeps all day."],
      ["Wieczorem|wieczór|in the evening Anna|-|Anna wraca|wracać|comes back do|=|to domu|dom|home (gen.) .", "In the evening Anna comes back home."],
      ["Kot|=|the cat jest|być|is bardzo|=|very szczęśliwy|=|happy !", "The cat is very happy!"],
    ],
  },
  {
    id: "t_seed_ar_souq", lang: "ar", title: "فِي السُّوقِ", titleTr: "At the market", newWords: ["خُبْز", "مَعَ", "شَاي", "أَرَادَ"],
    lines: [
      ["اسْمِي|اِسْم|my name سَارَة|-|Sara .", "My name is Sara."],
      ["أَنَا|=|I فِي|=|in السُّوقِ|سُوق|the market .", "I'm at the market."],
      ["السُّوقُ|سُوق|the market كَبِيرٌ|كَبِير|big .", "The market is big."],
      ["أُرِيدُ|أَرَادَ|I want قَهْوَةً|قَهْوَة|coffee وَخُبْزًا|خُبْز|and bread .", "I want coffee and bread."],
      ["أَخِي|أَخ|my brother مَعِي|مَعَ|with me .", "My brother is with me."],
      ["هُوَ|=|he يُرِيدُ|أَرَادَ|wants شَايًا|شَاي|tea .", "He wants tea."],
      ["نَشْرَبُ|شَرِبَ|we drink الْقَهْوَةَ|قَهْوَة|the coffee وَالشَّايَ|شَاي|and the tea فِي|=|in الْبَيْتِ|بَيْت|the house .", "We drink the coffee and the tea at home."],
      ["شُكْرًا|=|thank you !", "Thank you!"],
    ],
  },
];

export const starterTexts = (): Text[] =>
  STORIES.map((x) => ({
    id: x.id, updatedAt: 0, lang: x.lang, title: x.title, titleTr: x.titleTr, source: "seed", createdOn: "2026-11-23", newWords: x.newWords,
    sentences: x.lines.map(([spec, tr]) => sentence(x.lang, spec, tr)),
  }));
