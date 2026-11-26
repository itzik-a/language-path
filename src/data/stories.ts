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
  {
    id: "t_seed_el_gata", lang: "el", title: "Η γάτα της Μαρίας", titleTr: "Maria's cat", newWords: ["πρωί", "γάλα", "μετά", "δουλειά", "μόνος", "όλος", "μέρα", "βράδυ", "γυρίζω", "χαρούμενος"],
    lines: [
      ["Η|ο|the Μαρία|-|Maria έχει|έχω|has μια|ένας|a μικρή|μικρός|small γάτα|=|cat .", "Maria has a small cat."],
      ["Το|ο|the πρωί|=|morning η|ο|the Μαρία|-|Maria πίνει|πίνω|drinks καφέ|καφές|coffee (acc.) και|=|and η|ο|the γάτα|=|cat πίνει|πίνω|drinks γάλα|=|milk .", "In the morning Maria drinks coffee, and the cat drinks milk."],
      ["Μετά|=|then η|ο|the Μαρία|-|Maria πάει|πάω|goes στη|σε|to (the) δουλειά|=|work .", "Then Maria goes to work."],
      ["Η|ο|the γάτα|=|cat είναι|είμαι|is μόνη|μόνος|alone στο|σε|in the σπίτι|=|house .", "The cat is alone at home."],
      ["Κοιμάται|κοιμάμαι|it sleeps όλη|όλος|all τη|ο|the (acc.) μέρα|=|day .", "It sleeps all day."],
      ["Το|ο|the βράδυ|=|evening η|ο|the Μαρία|-|Maria γυρίζει|γυρίζω|comes back σπίτι|=|home .", "In the evening Maria comes back home."],
      ["Η|ο|the γάτα|=|cat είναι|είμαι|is πολύ|=|very χαρούμενη|χαρούμενος|happy !", "The cat is very happy!"],
    ],
  },
  {
    id: "t_seed_pt_bica", lang: "pt", title: "Uma manhã em Lisboa", titleTr: "A morning in Lisbon", newWords: ["morar", "manhã", "passar", "bairro", "pedir", "pastel", "nata", "fechado", "triste", "oferecer", "senhora", "sorte"],
    lines: [
      ["O|o|(the) João|-|João mora|morar|lives em|=|in Lisboa|-|Lisbon .", "João lives in Lisbon."],
      ["Todas|todo|every as|o|the manhãs|manhã|mornings , apanha|apanhar|he catches o|o|the elétrico|=|tram para|=|to o|o|the trabalho|=|work .", "Every morning he takes the tram to work."],
      ["Antes|=|before (that) , passa|passar|he stops pela|por|by the pastelaria|=|café do|de|of the bairro|=|neighbourhood .", "Before that, he stops at the neighbourhood café."],
      ["Pede|pedir|he orders uma|um|an bica|=|espresso e|=|and um|um|a pastel|=|pastry de|=|of nata|=|cream .", "He orders an espresso and a custard tart."],
      ["Hoje|=|today , a|o|the pastelaria|=|café está|estar|is fechada|fechado|closed !", "Today the café is closed!"],
      ["O|o|(the) João|-|João fica|ficar|gets triste|=|sad , mas|=|but não|=|not tem|ter|he has tempo|=|time .", "João is sad, but he has no time."],
      ["No|em|in the elétrico|=|tram , uma|um|a senhora|=|lady oferece-lhe|oferecer|offers him um|um|a pastel|=|pastry .", "On the tram, a lady offers him a pastry."],
      ["Que|=|what sorte|=|luck !", "What luck!"],
    ],
  },
  {
    id: "t_seed_ru_vasya", lang: "ru", title: "Кот Ва́ся", titleTr: "Vasya the cat", newWords: ["кот", "у́тро", "пото́м", "спать", "ве́чер", "приходи́ть", "рад"],
    lines: [
      ["Э́то|=|this is Ва́ся|-|Vasya .", "This is Vasya."],
      ["Ва́ся|-|Vasya — кот|=|a tomcat .", "Vasya is a cat."],
      ["Он|=|he живёт|жить|lives в|=|in большо́м|большо́й|big (prep.) до́ме|дом|house (prep.) .", "He lives in a big house."],
      ["У́тром|у́тро|in the morning Ва́ся|-|Vasya пьёт|пить|drinks молоко́|=|milk .", "In the morning Vasya drinks milk."],
      ["Пото́м|=|then он|=|he спит|спать|sleeps .", "Then he sleeps."],
      ["Ве́чером|ве́чер|in the evening прихо́дит|приходи́ть|comes па́па|=|dad .", "In the evening dad comes home."],
      ["Па́па|=|dad говори́т|говори́ть|says : « Приве́т|=|hi , Ва́ся|-|Vasya ! »", "Dad says: \"Hi, Vasya!\""],
      ["Ва́ся|-|Vasya о́чень|=|very рад|=|glad .", "Vasya is very glad."],
    ],
  },
  {
    id: "t_seed_es_sobremesa", lang: "es", title: "Una sobremesa larga", titleTr: "A long chat after lunch", newWords: ["alargarse", "cotilla", "casarse", "liar", "piso", "sacar"],
    lines: [
      ["El|=|the domingo|=|Sunday quedamos|quedar|we met up en|=|at casa|=|the house de|=|of mi|=|my abuela|=|grandmother para|=|to comer|=|have lunch .", "On Sunday we met up at my grandmother's for lunch."],
      ["Como|=|as siempre|=|always , la|=|the comida|=|meal se|=|(itself) alargó|alargarse|went on y|=|and nos|=|(ourselves) quedamos|quedarse|we stayed de|=|at sobremesa|=|after-lunch chat hasta|=|until las|=|the siete|=|seven .", "As always, lunch went on and on, and we stayed chatting at the table until seven."],
      ["Mi|=|my tío|=|uncle , que|=|who es|ser|is un|=|a cotilla|=|gossip , se|=|(himself) empeñó|empeñarse|insisted en|=|on enterarse|=|finding out de|=|about toda|todo|all mi|=|my vida|=|life .", "My uncle, who's a gossip, was set on finding out about my whole life."],
      ["Me|=|me preguntó|preguntar|he asked : « ¿ Y|=|and tú|=|you , cuándo|=|when te|=|(yourself) casas|casarse|get married ? »", "He asked me: \"And you, when are you getting married?\""],
      ["Yo|=|I , por|=|so as no|=|not liarla|liar|to stir things up , le|=|him dije|decir|I told que|=|that ya|=|(in time) veríamos|ver|we'd see .", "So as not to stir things up, I told him we'd see."],
      ["Pues|=|well encima|=|on top of that se|=|(himself) puso|ponerse|started a|=|to contar|=|tell que|=|that mi|=|my prima|primo|cousin (f.) se|=|(herself) había|haber|had comprado|comprar|bought un|=|a piso|=|flat .", "Well, on top of that he started telling everyone that my cousin had bought a flat."],
      ["Total|=|so , que|=|that no|=|not me|=|(myself) atreví|atreverse|I dared a|=|to irme|irse|leave hasta|=|until que|=|that mi|=|my abuela|=|grandmother sacó|sacar|brought out el|=|the café|=|coffee .", "So I didn't dare leave until my grandmother brought out the coffee."],
    ],
  },
  {
    id: "t_seed_fr_dimanche", lang: "fr", title: "Un dimanche raté", titleTr: "A Sunday that went wrong", newWords: ["prévoir", "rester", "pleuvoir", "corde", "série"],
    lines: [
      ["Dimanche|=|Sunday dernier|=|last , j'|je|I avais|avoir|had prévu|prévoir|planned de|=|to bosser|=|work un|=|a peu|=|little .", "Last Sunday I'd planned to get a bit of work done."],
      ["Bref|=|anyway , j'|je|I ai|avoir|have eu|avoir|had la|le|the flemme|=|laziness et|=|and je|=|I suis|être|am resté|rester|stayed au|à|in the lit|=|bed .", "Anyway, I couldn't be bothered and stayed in bed."],
      ["Vers|=|around midi|=|noon , mon|=|my pote|=|mate Karim|-|Karim m'|me|me a|avoir|has appelé|appeler|called .", "Around noon my mate Karim called me."],
      ["Il|=|he voulait|vouloir|wanted qu'|que|that on|=|we aille|aller|go (subj.) voir|=|see un|=|a film|=|film , mais|=|but franchement|=|honestly , il|=|it pleuvait|pleuvoir|was raining des|=|(some) cordes|corde|ropes .", "He wanted us to go and see a film, but honestly, it was pouring down."],
      ["Du|de|(as a) coup|=|result , il|=|he est|être|is venu|venir|came chez|=|to the home of moi|=|me avec|=|with des|=|some pizzas|pizza|pizzas .", "So he came over to mine with some pizzas."],
      ["On|=|we a|avoir|have regardé|regarder|watched une|un|a série|=|series nulle|nul|rubbish (f.) , mais|=|but c'|ce|it était|être|was vachement|=|really sympa|=|nice .", "We watched a rubbish series, but it was really nice."],
    ],
  },
  {
    id: "t_seed_it_bologna", lang: "it", title: "Un sabato a Bologna", titleTr: "A Saturday in Bologna", newWords: ["trovare", "ritardo", "prenotare", "tagliatella", "ritorno", "ultimo"],
    lines: [
      ["Sabato|=|Saturday scorso|=|last sono|essere|I (aux.) andato|andare|went a|=|to Bologna|-|Bologna a|=|to trovare|=|visit mia|mio|my (f.) cugina|cugino|cousin (f.) .", "Last Saturday I went to Bologna to visit my cousin."],
      ["Allora|=|so , il|=|the treno|=|train era|essere|was in|=|in ritardo|=|delay , come|=|as al|a|at the solito|=|usual .", "So, the train was late, as usual."],
      ["Quando|=|when sono|essere|I (aux.) arrivato|arrivare|arrived , lei|=|she mi|=|to me ha|avere|has detto|dire|said : « Dai|=|come on , sbrigati|sbrigarsi|hurry up , che|=|because abbiamo|avere|we have prenotato|prenotare|booked ! »", "When I arrived, she said: \"Come on, hurry up, we've booked a table!\""],
      ["Abbiamo|avere|we have mangiato|mangiare|eaten le|il|the tagliatelle|tagliatella|tagliatelle più|=|most buone|buono|good (f. pl.) della|di|of the mia|mio|my vita|=|life .", "We ate the best tagliatelle of my life."],
      ["Insomma|=|in short , una|un|a figata|=|great thing .", "In short, brilliant."],
      ["Però|=|but al|a|on the ritorno|=|return ho|avere|I have perso|perdere|missed l'|il|the ultimo|=|last treno|=|train , e|=|and mi|=|myself sono|essere|(aux.) dovuto|dovere|had to arrangiare|arrangiarsi|manage .", "But on the way back I missed the last train and had to make do."],
    ],
  },
  {
    id: "t_seed_de_zug", lang: "de", title: "Ein Montag mit Verspätung", titleTr: "A Monday with a delay", newWords: ["Verspätung", "Chef", "passieren", "treffen", "unterhalten", "Haltestelle", "verpassen", "schlimm"],
    lines: [
      ["Am|an|on (the) Montag|=|Monday wollte|wollen|wanted Lena|-|Lena früh|=|early ins|in|into the Büro|=|office fahren|=|to go .", "On Monday Lena wanted to get to the office early."],
      ["Aber|aber|but ihr|=|her Zug|=|train hatte|haben|had natürlich|=|of course Verspätung|=|a delay .", "But of course her train was late."],
      ["Sie|sie|she rief|anrufen|called ihren|ihr|her (acc.) Chef|=|boss an|anrufen|(called) und|=|and sagte|sagen|told ihm|er|him Bescheid|=|(word) .", "She called her boss and let him know."],
      ["Er|er|he meinte|meinen|said nur|=|only , das|das|that passiert|passieren|happens halt|=|just .", "He just said these things happen."],
      ["Im|in|in the Zug|=|train hat|haben|has sie|=|she dann|=|then einen|ein|an alten|alt|old Freund|=|friend getroffen|treffen|met .", "Then on the train she ran into an old friend."],
      ["Sie|sie|they haben|=|have sich|=|(each other) so|=|so gut|=|well unterhalten|=|talked , dass|=|that sie|=|she fast|=|almost ihre|ihr|her Haltestelle|=|stop verpasst|verpassen|missed hat|haben|has .", "They got talking so well that she almost missed her stop."],
      ["Eigentlich|eigentlich|actually war|sein|was die|der|the Verspätung|=|delay gar|=|at all nicht|=|not so|=|so schlimm|=|bad .", "Actually, the delay wasn't so bad after all."],
    ],
  },
  {
    id: "t_seed_nl_fietstocht", lang: "nl", title: "Een fietstocht", titleTr: "A bike ride", newWords: ["strand", "fietsen", "waaien", "halverwege", "lek", "band", "fietsenmaker", "terwijl", "terras", "halen"],
    lines: [
      ["Zaterdag|zaterdag|Saturday wilden|willen|wanted Sanne|-|Sanne en|=|and ik|=|I naar|=|to het|=|the strand|=|beach fietsen|=|cycle .", "On Saturday Sanne and I wanted to cycle to the beach."],
      ["Het|het|the weer|=|weather viel|tegenvallen|was disappointing een|=|a beetje|=|bit tegen|tegenvallen|(disappointing) , want|=|because het|=|it waaide|waaien|blew hard|=|hard .", "The weather was a bit disappointing, because it was very windy."],
      ["Halverwege|halverwege|halfway kreeg|krijgen|got ik|=|I ook|=|also nog|=|(on top) een|=|a lekke|lek|flat band|=|tyre .", "Halfway there I got a flat tyre too."],
      ["Gelukkig|gelukkig|luckily wist|weten|knew Sanne|-|Sanne een|=|a fietsenmaker|=|bike repairer in|=|in het|=|the dorp|=|village .", "Luckily Sanne knew a bike repairer in the village."],
      ["Terwijl|terwijl|while we|=|we wachtten|wachten|waited , dronken|drinken|drank we|=|we koffie|=|coffee op|=|on een|=|a terras|=|terrace .", "While we waited, we had coffee on a terrace."],
      ["Het|het|the strand|=|beach hebben|=|have we|=|we nooit|=|never gehaald|halen|reached , maar|=|but het|=|it was|zijn|was heel|=|very gezellig|=|fun .", "We never made it to the beach, but it was a lovely day."],
    ],
  },
];

export const starterTexts = (): Text[] =>
  STORIES.map((x) => ({
    id: x.id, updatedAt: 0, lang: x.lang, title: x.title, titleTr: x.titleTr, source: "seed", createdOn: "2026-11-23", newWords: x.newWords,
    sentences: x.lines.map(([spec, tr]) => sentence(x.lang, spec, tr)),
  }));
