export type LessonSection = {
  title: string;
  body: string[];
  examples?: Array<{ japanese: string; label: string; note: string }>;
  callout?: string;
};

export type QuizQuestion = {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type Lesson = {
  slug: string;
  title: string;
  duration: string;
  summary: string;
  sections: LessonSection[];
  quiz: QuizQuestion[];
};

export type Track = {
  slug: string;
  index: string;
  japanese: string;
  title: string;
  description: string;
  color: string;
  lessons: Lesson[];
};

export const curriculum: Track[] = [
  {
    slug: "sounds", index: "01", japanese: "音", title: "Sound foundations", color: "coral",
    description: "Build Japanese sounds deliberately, using familiar English moments only as signposts—not substitutes.",
    lessons: [
      {
        slug: "vowels", title: "Five steady vowels", duration: "8 min", summary: "A small, stable vowel system is the centre of clear Japanese.",
        sections: [
          { title: "One target for each vowel", body: ["Japanese vowels stay comparatively steady. Avoid the extra glide English speakers often add: え is not the moving vowel in ‘day’, and お is not the moving vowel in ‘go’. Keep the tongue and lips in one place.", "English comparisons below are approximations. Copy the Japanese TTS model, then use the comparison only to remember the general mouth shape."], examples: [
            { japanese: "あ", label: "a", note: "Open, like the central vowel in ‘father’ for many speakers." },
            { japanese: "い", label: "i", note: "Close to ‘ee’ in ‘fleece’, but short and clean." },
            { japanese: "う", label: "u", note: "A close back vowel with lightly compressed—not strongly rounded—lips." },
            { japanese: "え", label: "e", note: "Near ‘e’ in ‘met’; do not turn it into ay." },
            { japanese: "お", label: "o", note: "A steady mid-back rounded vowel; do not turn it into oh-oo." },
          ] },
          { title: "Length changes meaning", body: ["A long vowel lasts about two morae; a short vowel lasts one. It is not simply louder or tenser. おばさん (aunt) and おばあさん (grandmother) differ because あ is held for an extra timing unit."], callout: "Short explanation now, full timing practice in Prosody & mora." },
        ],
        quiz: [
          { prompt: "What should happen during a Japanese vowel?", options: ["The tongue glides to a second target", "The mouth stays on one clear target", "The vowel becomes louder"], answer: 1, explanation: "Japanese monophthongs are taught as steady vowel targets." },
          { prompt: "What distinguishes a long vowel?", options: ["Two timing units", "More stress", "A silent ending"], answer: 0, explanation: "Length is timing: a long vowel occupies about two morae." },
        ],
      },
      {
        slug: "consonants", title: "Consonants without English baggage", duration: "11 min", summary: "Change aspiration, tongue contact, and lip shape—not just spelling.",
        sections: [
          { title: "Use less air", body: ["English p, t and k are often strongly aspirated at the start of a stressed word. Japanese equivalents normally release less air. Hold a small strip of paper in front of your mouth: it should move much less for た than for an emphatic English ‘top’."], examples: [{ japanese: "たこ", label: "tako", note: "Keep t crisp, with little puff of air." }] },
          { title: "Tongue and tap", body: ["Japanese t, d, n and the r-row are usually made near the alveolar ridge behind the upper teeth. The r-row uses a brief alveolar tap /ɾ/: the tongue touches once. It is not an English r and not simply an l, though the middle sound of some American pronunciations of ‘water’ can be a useful approximation."], examples: [{ japanese: "から", label: "kara", note: "One quick tongue tap in ら." }] },
          { title: "Two unfamiliar fricatives", body: ["In ふ /ɸɯ/, the lips approach each other and air passes between them; the upper teeth do not touch the lower lip as they do for English f. In ひ /çi/, friction is made farther forward on the hard palate, similar to the sound some speakers use at the start of ‘hue’."], examples: [{ japanese: "ふね", label: "fune", note: "Blow gently between both lips." }, { japanese: "ひと", label: "hito", note: "Let the i pull the friction forward." }] },
        ],
        quiz: [
          { prompt: "The Japanese r-row is best described as…", options: ["An English r", "A held l", "A single alveolar tap"], answer: 2, explanation: "The tongue makes one brief contact near the alveolar ridge." },
          { prompt: "For Japanese ふ, what should the upper teeth do?", options: ["Touch the lower lip", "Stay away from the lower lip", "Close against the tongue"], answer: 1, explanation: "Japanese /ɸ/ is bilabial: both lips shape the friction." },
        ],
      },
      {
        slug: "special-timing", title: "N, doubles and quiet vowels", duration: "10 min", summary: "Hear the sounds English spelling tends to hide.",
        sections: [
          { title: "The moraic nasal ん", body: ["ん occupies its own mora. Its exact sound adapts to what follows: it may be more m-like before p, b or m, more n-like before t or d, and farther back before k or g. Learn the timing first rather than forcing one English n everywhere."], examples: [{ japanese: "さんぽ", label: "sanpo", note: "The nasal anticipates the following p." }] },
          { title: "Small っ means a held consonant", body: ["Small っ marks gemination: reserve one mora by closing or preparing for the following consonant before releasing it. In きって, the closure before t is held. It is not a general-purpose glottal stop."], examples: [{ japanese: "きって", label: "kitte", note: "ki — hold — te: three morae." }] },
          { title: "Vowel devoicing", body: ["High vowels /i/ and /ɯ/ can become very quiet between voiceless consonants or at the end of a phrase, as in the u of です. The timing slot remains even when voicing fades. This is a natural pattern, not a license to delete every i or u."], examples: [{ japanese: "すきです", label: "suki desu", note: "Some i/u voicing may soften in natural speech." }] },
        ],
        quiz: [
          { prompt: "What does small っ primarily mark?", options: ["A doubled/held following consonant", "A long vowel", "A pitch fall"], answer: 0, explanation: "Small っ gives the following consonant an extra mora of closure or preparation." },
          { prompt: "Does ん always have exactly the same articulation?", options: ["Yes", "No, it adapts to context", "Only in songs"], answer: 1, explanation: "Its place of articulation commonly assimilates to the following sound." },
        ],
      },
      {
        slug: "palatalization", title: "Palatalization and yōon", duration: "8 min", summary: "Treat consonant-plus-small-y sequences as one mora.",
        sections: [
          { title: "What palatalization means", body: ["Palatalization adds a tongue-body gesture toward the hard palate. In kana, an i-row kana followed by small ゃ, ゅ or ょ forms a yōon combination: きゃ kya, しゅ shu, ちょ cho. The phonetic symbol /j/ means the y sound in English ‘yes’; it does not mean the English letter-name j."], examples: [{ japanese: "きゃく", label: "kyaku", note: "きゃ is one mora, not ki + ya." }] },
        ],
        quiz: [
          { prompt: "How many morae are in きゃ?", options: ["One", "Two", "Three"], answer: 0, explanation: "An i-row kana plus small ゃ/ゅ/ょ forms one yōon mora." },
          { prompt: "In phonetics, /j/ represents…", options: ["The sound in English ‘jam’", "The y sound in ‘yes’", "A long i"], answer: 1, explanation: "IPA /j/ is a palatal approximant, like English y." },
        ],
      },
    ],
  },
  {
    slug: "prosody", index: "02", japanese: "拍", title: "Prosody & mora", color: "mint",
    description: "Stop counting English syllables. Feel Japanese timing as a sequence of equally important morae.",
    lessons: [
      {
        slug: "mora", title: "The Japanese beat", duration: "9 min", summary: "Meet the timing unit that organizes Japanese rhythm.",
        sections: [
          { title: "Syllable is not enough", body: ["English rhythm often compresses unstressed syllables and stretches stressed ones. Japanese is organized around morae: compact timing units that speakers perceive and coordinate with. A regular kana usually represents one mora, but the important exceptions reveal the system."], examples: [{ japanese: "にほん", label: "ni-ho-n", note: "Three morae; ん receives its own beat." }] },
          { title: "Count the hidden beats", body: ["A long vowel contributes a second mora, small っ contributes a closure mora, and ん contributes a nasal mora. Yōon such as きょ remains one mora because the second kana is small."], examples: [{ japanese: "がっこう", label: "ga-Q-ko-o", note: "Four morae: が・っ・こ・う." }, { japanese: "きょう", label: "kyo-o", note: "Two morae: きょ・う." }] },
        ],
        quiz: [
          { prompt: "How many morae are in にほん?", options: ["Two", "Three", "Four"], answer: 1, explanation: "に・ほ・ん: the moraic nasal counts independently." },
          { prompt: "How many morae are in きょ?", options: ["One", "Two", "Three"], answer: 0, explanation: "Small ょ joins き to form a single yōon mora." },
        ],
      },
      {
        slug: "length", title: "Long vowels and geminates", duration: "10 min", summary: "Give duration the same attention English gives stress.",
        sections: [
          { title: "Long vowels", body: ["Hold a long vowel through two beats without changing its quality. Hiragana may spell the second beat with the same vowel or with う/い according to convention; katakana often uses ー. The mark ー extends the preceding vowel, so コーヒー is ko-o-hi-i."], examples: [{ japanese: "ここ / こうこう", label: "koko / kōkō", note: "Two morae versus four." }, { japanese: "コーヒー", label: "kōhī", note: "Each ー adds one mora." }] },
          { title: "Small っ", body: ["For stops, close the mouth for one beat before release; for sounds such as s, hold the friction. Clap the empty-looking beat instead of inserting a vowel."], examples: [{ japanese: "さか / さっか", label: "saka / sakka", note: "The second word has an extra closure mora." }] },
        ],
        quiz: [
          { prompt: "What does ー do in katakana?", options: ["Repeats the word", "Extends the previous vowel by one mora", "Adds stress"], answer: 1, explanation: "The long-vowel mark adds duration to the preceding vowel." },
          { prompt: "During っ before k, you should…", options: ["Insert u", "Hold the k closure for a beat", "Raise the pitch"], answer: 1, explanation: "The extra mora is expressed as consonant closure/preparation." },
        ],
      },
      {
        slug: "phrasing", title: "Rhythm beyond the word", duration: "8 min", summary: "Keep morae legible while letting phrases breathe.",
        sections: [
          { title: "Even does not mean robotic", body: ["Mora-timing is a perceptual guide, not a metronome rule that makes every segment physically identical. Natural speech groups words into phrases, speeds up and slows down, and still preserves contrasts such as vowel length and gemination."], callout: "Aim for clear proportions first. Natural flexibility comes after the contrasts are reliable." },
          { title: "Tap, then release the tap", body: ["Begin by tapping each mora. Repeat without tapping while keeping the internal pattern. Finally place the word in a short phrase and preserve the long/short contrast."], examples: [{ japanese: "きょうは がっこうへ", label: "kyō wa gakkō e", note: "Hear the two long vowels and the closure mora inside a phrase." }] },
        ],
        quiz: [
          { prompt: "Mora timing means natural speech must be perfectly mechanical.", options: ["True", "False"], answer: 1, explanation: "Phrases vary naturally; mora structure still protects important contrasts." },
          { prompt: "A useful practice progression is…", options: ["Fast first", "Tap, repeat internally, then phrase", "Ignore timing in phrases"], answer: 1, explanation: "External tapping can become an internal timing pattern." },
        ],
      },
    ],
  },
  {
    slug: "pitch", index: "03", japanese: "高低", title: "Tokyo pitch accent", color: "indigo",
    description: "Learn where pitch falls—and where it does not—without importing English stress.",
    lessons: [
      {
        slug: "pitch-not-stress", title: "Pitch, not punch", duration: "8 min", summary: "Japanese lexical accent uses pitch relationships, not English-style force.",
        sections: [
          { title: "Listen for a downstep", body: ["In Tokyo Japanese, an accented word has a point after which pitch drops. That drop is the accent nucleus or downstep. Do not manufacture it by making one mora louder, longer, or tenser as English stress often does."], examples: [{ japanese: "あめ", label: "ame", note: "The same mora sequence can carry different pitch patterns in different words." }] },
          { title: "Three careful limits", body: ["Pitch accent differs by dialect, speaker and context. Dictionary patterns describe a citation form, while connected speech reshapes the full phrase. This course teaches a mainstream Tokyo model and links to OJAD for checked word patterns."], callout: "The browser voice is synthesized. Use it for repeatability, not as the final authority on every pitch contour." },
        ],
        quiz: [
          { prompt: "A Tokyo-Japanese accent nucleus is heard mainly as…", options: ["A pitch drop after a mora", "A louder vowel", "A longer consonant"], answer: 0, explanation: "The defining cue is the location of the downstep." },
          { prompt: "Does every Japanese dialect share one accent system?", options: ["Yes", "No"], answer: 1, explanation: "Pitch-accent systems vary by region and speaker." },
        ],
      },
      {
        slug: "four-patterns", title: "Four useful patterns", duration: "12 min", summary: "Classify words by the presence and location of their downstep.",
        sections: [
          { title: "Heiban and atamadaka", body: ["Heiban (unaccented) has no lexical downstep inside the word; after an initial rise, pitch can remain high through a following particle. Atamadaka is accented on the first mora, so pitch drops immediately after it."], examples: [{ japanese: "さくらが", label: "heiban: L-H-H-H", note: "No lexical fall before the particle in the basic model." }, { japanese: "いのちが", label: "atamadaka: H-L-L-L", note: "The fall comes after the first mora." }] },
          { title: "Nakadaka and odaka", body: ["Nakadaka drops after a mora inside the word, with one or more morae following. Odaka keeps the word high through its final mora, then drops before a following particle. In isolation, heiban and odaka can sound alike; add a particle to expose the difference."], examples: [{ japanese: "こころが", label: "nakadaka: L-H-L-L", note: "A word-internal fall." }, { japanese: "やまが", label: "odaka: L-H-L", note: "The particle reveals the fall after the noun." }] },
        ],
        quiz: [
          { prompt: "Which pattern has no lexical downstep?", options: ["Heiban", "Atamadaka", "Nakadaka", "Odaka"], answer: 0, explanation: "Heiban is the unaccented pattern." },
          { prompt: "Why add a particle when comparing heiban and odaka?", options: ["It makes the word plural", "It reveals whether pitch falls after the word", "It lengthens the first mora"], answer: 1, explanation: "A following particle exposes the final boundary downstep of odaka." },
        ],
      },
      {
        slug: "phrases", title: "From word to phrase", duration: "9 min", summary: "Keep lexical patterns inside a larger melody.",
        sections: [
          { title: "Accentual phrases", body: ["Words do not keep a rigid pitch drawing when joined. An accentual phrase often begins with a rise and trends downward overall; a lexical downstep constrains what follows. Focus on the relative fall, not an absolute musical note."], examples: [{ japanese: "あたらしい ほんです", label: "atarashii hon desu", note: "Practise as one phrase, then compare the component words." }] },
          { title: "Emphasis is additional", body: ["Speakers can widen the pitch range or reshape phrasing to emphasize information. That is separate from a word’s lexical accent. First make the word pattern stable, then observe how focus changes the surrounding phrase."], callout: "Pitch diagrams are simplified teaching models, not sheet music." },
        ],
        quiz: [
          { prompt: "Pitch diagrams show…", options: ["Exact musical notes", "Relative pitch relationships", "Volume only"], answer: 1, explanation: "The useful information is relative high/low movement and downstep location." },
          { prompt: "Emphasis and lexical pitch accent are identical.", options: ["True", "False"], answer: 1, explanation: "Focus can reshape a phrase, but it is not the same as the stored lexical pattern." },
        ],
      },
    ],
  },
  {
    slug: "kana", index: "04", japanese: "かな", title: "Kana", color: "gold",
    description: "Learn a small family, prove both reading and recall, then mix it into everything you already know.",
    lessons: [
      {
        slug: "how-kana-works", title: "How kana works", duration: "7 min", summary: "Understand the writing system before memorising shapes.",
        sections: [
          { title: "Two scripts, shared sounds", body: ["Hiragana and katakana represent the same mora inventory. Hiragana is common for grammatical material and many native words; katakana is common for loanwords, names used for emphasis, sound symbolism and technical labels. You will train each script separately so visual confidence transfers cleanly."], examples: [{ japanese: "あ / ア", label: "a", note: "Different shapes, the same basic mora." }] },
          { title: "Marks and combinations", body: ["Dakuten ゛voices a consonant row; handakuten ゜creates the p-row. Small ゃ/ゅ/ょ combine with an i-row kana into one mora. Small っ marks a held consonant. In katakana, ー extends the preceding vowel; small vowel kana also help write foreign sound combinations."], callout: "Small っ and long-vowel spelling are taught in context, not as misleading one-symbol/one-rōmaji flashcards." },
        ],
        quiz: [
          { prompt: "Hiragana and katakana generally represent…", options: ["Different languages", "The same mora inventory", "Pitch patterns only"], answer: 1, explanation: "Their shapes and usual roles differ, but their core sound inventory is shared." },
          { prompt: "How will small っ be trained?", options: ["As a standalone rōmaji letter", "Inside real timing contexts", "It will be ignored"], answer: 1, explanation: "Its value depends on the following consonant, so context is essential." },
        ],
      },
      {
        slug: "hiragana-path", title: "Hiragana learning path", duration: "guided", summary: "Unlock one group at a time with cumulative SRS.",
        sections: [
          { title: "Teach, test, retain", body: ["Study the shapes and replay their synthesized pronunciation. Then read kana into rōmaji and recall kana from rōmaji using the shuffled grid. Each direction has its own FSRS card. A group becomes proficient when every card is answered correctly twice in a row; older due and weak cards stay mixed in as you advance."], callout: "The trainer starts with あ・い・う・え・お, then unlocks the K row." },
        ],
        quiz: [
          { prompt: "Recognition and recall share one score.", options: ["True", "False"], answer: 1, explanation: "They are scheduled independently because reading and recall develop at different rates." },
          { prompt: "What happens to older kana?", options: ["They disappear", "They continue to appear when due or weak", "They reset each group"], answer: 1, explanation: "Cumulative review protects earlier learning." },
        ],
      },
      {
        slug: "katakana-path", title: "Katakana learning path", duration: "guided", summary: "Repeat the cumulative path with sharper, loanword-ready forms.",
        sections: [
          { title: "The second visual map", body: ["Katakana follows the same sound order, so the challenge is primarily visual. Train commonly confused shapes deliberately—シ/ツ and ソ/ン—by noticing stroke direction and proportions rather than inventing English-letter mnemonics alone."], examples: [{ japanese: "シ・ツ・ソ・ン", label: "shi · tsu · so · n", note: "Compare the direction and alignment of the short strokes." }] },
        ],
        quiz: [
          { prompt: "What changes between あ and ア?", options: ["The basic sound", "The script shape and typical use", "The mora count"], answer: 1, explanation: "Both represent a; their script and usage differ." },
          { prompt: "How should similar katakana be distinguished?", options: ["Only by guessing from English", "By stroke direction and proportion", "By pitch"], answer: 1, explanation: "Visual structure provides reliable distinguishing cues." },
        ],
      },
    ],
  },
];

export const trackBySlug = Object.fromEntries(curriculum.map((track) => [track.slug, track]));

export function getLesson(trackSlug: string, lessonSlug: string) {
  return trackBySlug[trackSlug]?.lessons.find((lesson) => lesson.slug === lessonSlug);
}
