export type LessonSection = {
  title: string;
  body: string[];
  examples?: Array<{ japanese: string; label: string; note: string }>;
  callout?: string;
  tapAlong?: { units: string[]; prompt: string; note: string };
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
    description: "Learn to pronounce Japanese vowels and consonants clearly.",
    lessons: [
      {
        slug: "vowels", title: "The five vowels", duration: "8 min", summary: "Start with five clear sounds: a, i, u, e and o.",
        sections: [
          { title: "Keep each vowel steady", body: ["Think of the English word ‘go’: your mouth often moves from an ‘oh’ sound towards ‘oo’. For Japanese お, keep just the first part. The same idea applies to え: keep it steady rather than turning it into the ‘ay’ in ‘day’.", "English comparisons can help you find a starting mouth shape, but they vary with your accent. Listen to the Japanese audio and try to copy the sound."], examples: [{"japanese": "あ", "label": "a", "note": "Open your mouth comfortably. Think of the ‘a’ in ‘father’ as a starting point."}, {"japanese": "い", "label": "i", "note": "Start with the ‘ee’ in ‘see’. Keep the sound clear and steady."}, {"japanese": "う", "label": "u", "note": "Say ‘oo’ without pushing your lips forward. Keep them more relaxed than in English ‘sue’."}, {"japanese": "え", "label": "e", "note": "Start near the ‘e’ in ‘met’. Keep it steady, without adding a ‘y’ sound at the end."}, {"japanese": "お", "label": "o", "note": "Start with the first part of ‘go’, then keep your mouth still. Avoid adding ‘oo’ at the end."}] },
          { title: "Holding a vowel changes the word", body: ["A short vowel takes one beat; a long vowel takes two. These beats are called morae (one beat is a mora). Hold the same sound for longer without making it louder. おばさん means ‘aunt’, while おばあさん means ‘grandmother’: the extra あ changes the word."], callout: "Try saying the long vowel over two taps. You will practise these beats in Prosody & mora." },
        ],
        quiz: [
          { prompt: "What should your mouth do during a Japanese vowel?", options: ["Move towards a second vowel sound", "Stay in roughly the same position", "Make the sound louder"], answer: 1, explanation: "Keep the vowel steady from beginning to end." },
          { prompt: "What makes a vowel long?", options: ["Holding it for two beats", "Saying it more strongly", "Leaving the ending silent"], answer: 0, explanation: "A long vowel lasts for two beats rather than one." },
          { prompt: "How should え differ from the vowel in English ‘day’?", options: ["Change sound more as you say it", "Keep the same sound throughout", "Be said through the nose"], answer: 1, explanation: "Keep え steady instead of adding the ‘y’ sound you may hear at the end of ‘day’." },
          { prompt: "What changes おばさん into おばあさん?", options: ["Holding あ for an extra beat", "Making the first part louder", "Adding a silent consonant"], answer: 0, explanation: "The extra beat on あ changes ‘aunt’ to ‘grandmother’." },
          { prompt: "How should you use the English sound comparisons?", options: ["As an exact match for Japanese", "As a mouth-shape guide before copying Japanese audio", "As a replacement for listening to Japanese audio"], answer: 1, explanation: "Use English to get started, then listen to how the Japanese sound differs." },
        ],
      },
      {
        slug: "consonants", title: "Small changes to familiar consonants", duration: "11 min", summary: "Try a lighter puff of air, a quick tongue tap, and a different way to say f.",
        sections: [
          { title: "Notice your tongue and lips", body: ["You do not need to memorise a diagram of the mouth. Start by feeling the small ridge just behind your upper front teeth, then the firm roof of your mouth farther back. You will use these places as guides.", "Try one change at a time: where your tongue touches, how close your lips are, or how much air you let out."], examples: [{"japanese": "た・ら・ひ・ふ", "label": "ta · ra · hi · fu", "note": "Notice how your tongue and lips move between these sounds."}] },
          { title: "Use a smaller puff of air", body: ["Say the English word ‘top’ with emphasis and feel the puff of air. Japanese t, p and k usually use less of that puff. Try holding a small piece of paper in front of your mouth: it should move less when you say た."], examples: [{"japanese": "たこ", "label": "tako", "note": "Keep t crisp, with little puff of air."}] },
          { title: "Give r one quick tap", body: ["For Japanese t, d and n, your tongue touches near the back of your upper teeth. For the r in ら, let the tip tap the ridge just behind them once, then move away.", "It can sound somewhere between an English r and l. Avoid holding either sound. If you use a quick tap for the middle of ‘water’ in American English, that can be a useful starting point."], examples: [{"japanese": "から", "label": "kara", "note": "One quick tongue tap in ら."}] },
          { title: "Try f without your teeth", body: ["For ふ, bring your lips close together and blow gently between them. Keep your upper teeth away from your lower lip. It may feel somewhere between English f and h.", "For ひ, start with ‘hee’ and bring the middle of your tongue closer to the roof of your mouth. Let the air pass through that narrow space. Some English speakers make a similar sound at the start of ‘hue’."], examples: [{"japanese": "ふね", "label": "fune", "note": "Blow gently between both lips."}, {"japanese": "ひと", "label": "hito", "note": "Keep the middle of your tongue raised as you say ‘hee’."}] },
        ],
        quiz: [
          { prompt: "How should you make the Japanese r sound?", options: ["Hold an English r", "Hold an English l", "Tap your tongue once, quickly"], answer: 2, explanation: "Touch the ridge behind your upper teeth briefly, then release." },
          { prompt: "For Japanese ふ, what should your upper teeth do?", options: ["Touch your lower lip", "Stay away from your lower lip", "Close against your tongue"], answer: 1, explanation: "Shape the sound with your two lips, without using your teeth." },
          { prompt: "Compared with a strongly spoken English t, Japanese t usually uses…", options: ["Less air", "More air", "No tongue contact"], answer: 0, explanation: "Aim for a smaller puff of air." },
          { prompt: "Where should your tongue tap for Japanese r?", options: ["The ridge just behind your upper front teeth", "The back of your throat", "Your lower lip"], answer: 0, explanation: "Use one quick touch near the ridge behind your upper teeth." },
          { prompt: "What should you try when saying ひ?", options: ["Raise the middle of your tongue towards the roof of your mouth", "Close your lips completely", "Keep your tongue low and flat"], answer: 0, explanation: "Start with ‘hee’ and narrow the space between your tongue and the roof of your mouth." },
        ],
      },
      {
        slug: "special-timing", title: "N, doubled sounds and quiet vowels", duration: "10 min", summary: "Give ん and small っ their own beat, and listen for vowels that become very quiet.",
        sections: [
          { title: "Give ん its own beat", body: ["ん gets a beat of its own, but it does not always sound like the English n. Your mouth gets ready for the next sound: before p, b or m it may sound more like m; before k or g, it is made farther back in the mouth.", "Focus on keeping its beat rather than forcing the same n sound into every word."], examples: [{"japanese": "さんぽ", "label": "sanpo", "note": "Your lips get ready for p, so ん may sound a little like m."}] },
          { title: "Hold the next consonant for small っ", body: ["Small っ tells you to spend an extra beat on the consonant that follows. In きって, get your tongue ready for t, hold that position for a beat, then say て. Do not add another vowel in the gap."], examples: [{"japanese": "きって", "label": "kitte", "note": "ki — hold — te: three beats."}] },
          { title: "Some vowels become almost whispered", body: ["You may barely hear the i or u in some words. This often happens between consonants such as k, s and t, or at the end of a phrase, as with the u in です. This is called vowel devoicing.", "Listen for this quieter sound without rushing past its beat. You do not need to force it, and it does not mean every i or u should disappear."], examples: [{"japanese": "すきです", "label": "suki desu", "note": "Listen for how quiet the i in suki and the final u in desu can become."}] },
        ],
        quiz: [
          { prompt: "What does small っ tell you to do?", options: ["Hold the following consonant for an extra beat", "Hold the vowel for longer", "Drop your pitch"], answer: 0, explanation: "Get ready for the next consonant and give that hold its own beat." },
          { prompt: "Does ん always sound exactly the same?", options: ["Yes", "No, it changes with the sounds around it", "It changes only in songs"], answer: 1, explanation: "Your mouth often gets ready for the next sound while you say ん." },
          { prompt: "How much time should you give ん?", options: ["One beat of its own", "No time of its own", "Half the word"], answer: 0, explanation: "Keep a beat for ん even when its sound changes." },
          { prompt: "When i or u becomes very quiet, what should you still keep?", options: ["Its place in the word's rhythm", "A new pitch pattern", "An extra English vowel"], answer: 0, explanation: "A quiet vowel should not make you rush through the word." },
          { prompt: "What should you avoid when holding the consonant after small っ?", options: ["Getting ready for the consonant", "Holding for one beat", "Adding another vowel"], answer: 2, explanation: "Hold the consonant rather than filling the gap with an extra ‘uh’ sound." },
        ],
      },
      {
        slug: "palatalization", title: "Small ゃ, ゅ and ょ combinations", duration: "8 min", summary: "Join sounds like kya and kyu smoothly, without adding an extra beat.",
        sections: [
          { title: "Blend the y sound in", body: ["Say the k in English ‘key’, then the k in ‘car’. You may feel the middle of your tongue sit higher for ‘key’. A similar tongue movement helps with sounds like kya and kyu. Raising the tongue towards the roof of the mouth like this is called palatalization.", "In きゃ, blend the k and y together. Do not say a full ‘ki’ and then ‘ya’. The combination takes just one beat. Kana ending in an i sound can combine with small ゃ, ゅ or ょ: for example, きゃ (kya), しゅ (shu) and ちょ (cho). These combinations are called yōon."], examples: [{"japanese": "きゃく", "label": "kyaku", "note": "Say kya-ku: two beats. Keep kya together."}] },
        ],
        quiz: [
          { prompt: "How many beats are in きゃ?", options: ["One", "Two", "Three"], answer: 0, explanation: "き and small ゃ combine into one beat: kya." },
          { prompt: "Which English sound helps you understand the y in kya?", options: ["The j in ‘jam’", "The y in ‘yes’", "A long ‘ee’"], answer: 1, explanation: "Blend in a y sound like the start of ‘yes’, without adding a separate beat." },
          { prompt: "How many beats are in きゃく?", options: ["One", "Two", "Three"], answer: 1, explanation: "Count きゃ・く: kya-ku." },
          { prompt: "What makes small ゃ different from full-sized や?", options: ["Small ゃ joins the kana before it", "Small ゃ is silent", "Full-sized や has no vowel"], answer: 0, explanation: "Small ゃ combines with the previous kana. Full-sized や gets its own beat." },
          { prompt: "For the blended sound in kya, where does the middle of your tongue move?", options: ["Towards your lower lip", "Towards the roof of your mouth", "Down towards your throat"], answer: 1, explanation: "Raise the middle of your tongue as you blend in the y sound." },
        ],
      },
    ],
  },
  {
    slug: "prosody", index: "02", japanese: "拍", title: "Prosody & mora", color: "mint",
    description: "Learn the timing and rhythm of Japanese words.",
    lessons: [
      {
        slug: "mora", title: "The Japanese beat", duration: "9 min", summary: "Learn to count the small beats that give Japanese its rhythm.",
        sections: [
          { title: "Listen for the beats", body: ["Prosody means the rhythm and melody of speech: how your voice rises and falls, what you emphasise, and how long sounds last. In English, we often stretch one part of a word and hurry through the rest. Think of how ‘university’ has one part that stands out.", "For Japanese, start by counting small beats called morae (one beat is a mora). Many kana take one beat each, but sounds such as ん and a held vowel need time too."], examples: [{"japanese": "にほん", "label": "ni-ho-n", "note": "ni-ho-n: three beats. Give ん its own tap."}] },
          { title: "Do not skip the less obvious beats", body: ["A long vowel takes two beats. Small っ takes one beat for holding the next consonant. ん also gets one beat of its own.", "Combinations with small ゃ, ゅ or ょ, such as きょ, stay together as one beat. So きょう is kyo-o: two beats, with the o sound held through the second."], examples: [{"japanese": "がっこう", "label": "ga — hold — ko-o", "note": "Four beats: が・っ・こ・う."}, {"japanese": "きょう", "label": "kyo-o", "note": "Two beats: きょ・う. Hold the o sound for the second beat."}], tapAlong: {"units": ["が", "っ", "こ", "う"], "prompt": "Tap がっこう", "note": "Tap once for が, once for the hold at っ, then twice for the long o in こう."} },
        ],
        quiz: [
          { prompt: "How many beats are in にほん?", options: ["Two", "Three", "Four"], answer: 1, explanation: "Count に・ほ・ん. The final ん gets its own beat." },
          { prompt: "How many beats are in きょ?", options: ["One", "Two", "Three"], answer: 0, explanation: "Small ょ joins き, so kyo stays together as one beat." },
          { prompt: "How many beats are in がっこう?", options: ["Two", "Three", "Four"], answer: 2, explanation: "Count が・っ・こ・う, including the hold and the extra time for the long o." },
          { prompt: "Which of these gets its own beat?", options: ["ん", "A space between words", "English-style emphasis"], answer: 0, explanation: "ん needs time of its own, even though it has no separate vowel." },
          { prompt: "Compared with a short vowel, what does a long vowel add?", options: ["One extra beat", "One extra consonant", "A drop in pitch"], answer: 0, explanation: "Keep the same vowel going for a second beat." },
        ],
      },
      {
        slug: "length", title: "Long vowels and doubled consonants", duration: "10 min", summary: "Holding a sound for longer can change the word you are saying.",
        sections: [
          { title: "Hold the vowel, not your breath", body: ["A long vowel is the same sound held for two beats. Keep the sound going rather than putting a pause between the beats.", "In hiragana, a long vowel may use a repeated vowel or spellings with う or い. In katakana, you will often see ー. It means ‘hold the vowel before this for another beat’: コーヒー is ko-o-hi-i."], examples: [{"japanese": "ここ / こうこう", "label": "koko / kōkō", "note": "Two beats versus four."}, {"japanese": "コーヒー", "label": "kōhī", "note": "Each ー adds one beat."}] },
          { title: "Hold the consonant for small っ", body: ["For a consonant like k or t, get your tongue into position and hold it there for one beat before letting the sound out. For s, keep the hissing sound going for the extra beat.", "Compare さか (slope) with さっか (writer). The second word has an extra hold before k. Avoid putting an ‘uh’ sound in that hold."], examples: [{"japanese": "さか / さっか", "label": "saka / sakka", "note": "saka versus sak-ka: hold before the k in the second word."}] },
        ],
        quiz: [
          { prompt: "What does ー tell you to do in katakana?", options: ["Repeat the word", "Hold the previous vowel for one more beat", "Make the word louder"], answer: 1, explanation: "Keep the vowel going for another beat." },
          { prompt: "When small っ comes before k, what should you do?", options: ["Add a u sound", "Get ready for k and hold for a beat", "Raise your pitch"], answer: 1, explanation: "Hold your tongue in position for k, then release it." },
          { prompt: "How many beats are in コーヒー?", options: ["Two", "Three", "Four"], answer: 2, explanation: "Count ko-o-hi-i. Both vowels are long." },
          { prompt: "What extra part do you hear in さっか compared with さか?", options: ["A hold before k", "A blended y sound", "Only a change in pitch"], answer: 0, explanation: "Small っ adds a beat before you release the k." },
          { prompt: "What should you avoid adding during that hold?", options: ["A silent beat", "An extra vowel", "Time to get ready for the consonant"], answer: 1, explanation: "Keep the hold clear instead of filling it with another vowel." },
        ],
      },
      {
        slug: "phrasing", title: "Keeping the rhythm in a sentence", duration: "8 min", summary: "Keep long and short sounds clear as you start joining words together.",
        sections: [
          { title: "You do not need to sound like a robot", body: ["Tapping is a way to notice the beats, not a rule that every sound must last exactly the same number of milliseconds. Real speech speeds up, slows down and groups words together.", "What matters is keeping the differences clear: a long vowel still needs more time than a short one, and a doubled consonant still needs its hold."], callout: "Start slowly enough to hear the difference. Let your speed become more natural as you get comfortable." },
          { title: "Tap, say it again, then add a phrase", body: ["First, tap the beats while saying a word. Next, say it without tapping and try to keep the same rhythm. Finally, use it in a short phrase. Listen for the long vowels and consonant holds each time."], examples: [{"japanese": "きょうは がっこうへ", "label": "kyō wa gakkō e", "note": "Keep the long o in きょう and がっこう, plus the hold at っ."}] },
        ],
        quiz: [
          { prompt: "Does Japanese need to sound perfectly mechanical?", options: ["Yes", "No"], answer: 1, explanation: "Natural speech can speed up and slow down while keeping long and short sounds clear." },
          { prompt: "Which practice order is useful?", options: ["Start as fast as possible", "Tap the word, say it without tapping, then use it in a phrase", "Ignore the rhythm once you use a sentence"], answer: 1, explanation: "Tapping helps you learn a rhythm you can later keep without your hands." },
          { prompt: "What does practising with even beats NOT mean?", options: ["Keeping long and short sounds different", "Making every sound last exactly the same time", "Giving ん and small っ enough time"], answer: 1, explanation: "Use the beats as a guide, without forcing every sound to be identical in length." },
          { prompt: "When you put a word in a phrase, what should stay clear?", options: ["Long vowels and doubled consonants", "Only the loudest part", "An exact metronome speed"], answer: 0, explanation: "You can speak more naturally while still keeping the extra time these sounds need." },
          { prompt: "After you can tap a word comfortably, what is a useful next step?", options: ["Skip the difficult beats", "Say it without tapping while keeping the rhythm", "Make every beat louder"], answer: 1, explanation: "Try keeping the rhythm in your voice without relying on your hands." },
        ],
      },
    ],
  },
  {
    slug: "pitch", index: "03", japanese: "高低", title: "Pitch accent", color: "indigo",
    description: "Learn the four basic pitch accents in Japanese.",
    lessons: [
      {
        slug: "pitch-not-stress", title: "Hear the rise and fall", duration: "8 min", summary: "Listen to how high or low the voice goes, rather than how loud it gets.",
        sections: [
          { title: "Listen for where the voice drops", body: ["Pitch is how high or low your voice sounds. In English, an emphasised part often becomes louder, longer and higher together. When learning Japanese pitch accent, focus on the rise and fall of the voice.", "In the Tokyo model taught here, some words have a point where the pitch drops. You may see this called a downstep. Other words have no such drop. Practise changing the height of your voice without adding a big push of volume."], examples: [{"japanese": "あめ", "label": "ame", "note": "あめ can mean ‘rain’ or ‘candy’, with different pitch patterns in the Tokyo model. This audio gives one reading; use the linked accent dictionary to compare both."}] },
          { title: "Limitations of this resource", body: ["Pitch accent can differ greatly by location. This resource teaches a mainstream Tokyo model and does not represent a one-size-fits-all pitch accent for the entirety of Japan."], callout: "The audio can help you practise, but it may not get every word's pitch right. Use the linked accent dictionary to check a pattern." },
        ],
        quiz: [
          { prompt: "What are you listening for in a word with a pitch drop?", options: ["The voice going from higher to lower after a beat", "A louder vowel", "A longer consonant"], answer: 0, explanation: "Listen for where the voice drops, rather than where it gets louder." },
          { prompt: "Is pitch accent the same everywhere in Japan?", options: ["Yes", "No"], answer: 1, explanation: "Pitch patterns vary by region and speaker." },
          { prompt: "What should you avoid when practising a pitch drop?", options: ["Changing how high or low your voice is", "Pushing one beat much louder or harder", "Listening across the word"], answer: 1, explanation: "A pitch drop is a change in voice height. You do not need a strong burst of volume." },
          { prompt: "Which model does this resource teach?", options: ["Every regional accent at once", "A mainstream Tokyo model", "English word stress"], answer: 1, explanation: "This resource introduces a Tokyo model, while other regions can use different patterns." },
          { prompt: "How should you use the lesson audio for pitch practice?", options: ["Assume every pitch pattern is correct", "Practise with it, and check patterns in an accent dictionary", "Assume it is a recording of a teacher"], answer: 1, explanation: "The audio is useful for repetition, but it can get a pitch pattern wrong." },
        ],
      },
      {
        slug: "four-patterns", title: "Four useful patterns", duration: "12 min", summary: "Get to know four patterns by listening for where the pitch drops.",
        sections: [
          { title: "Heiban and atamadaka", body: ["The names may look unfamiliar, but each describes a simple pattern. In the examples below, H means higher and L means lower. These are relative to your own voice.", "Heiban starts low, rises, and has no word-level pitch drop. A short word such as が after it stays high in the basic pattern. These short grammatical words are called particles.", "Atamadaka starts high and drops after the first beat. The rest of the word and the following particle stay lower."], examples: [{"japanese": "さくらが", "label": "heiban: L-H-H-H", "note": "The pitch stays high on the following が."}, {"japanese": "いのちが", "label": "atamadaka: H-L-L-L", "note": "Start high, then drop after い."}] },
          { title: "Nakadaka and odaka", body: ["Nakadaka drops somewhere in the middle of the word, with at least one beat of the word still to come.", "Odaka drops just after the last beat of the word, so a following particle like が is low. For words with more than one beat, heiban and odaka can sound alike when said alone. Add が to hear whether the pitch stays high or drops."], examples: [{"japanese": "こころが", "label": "nakadaka: L-H-L-L", "note": "The pitch drops after the second こ, before ろ."}, {"japanese": "やまが", "label": "odaka: L-H-L", "note": "The pitch drops after やま, so が is low."}] },
        ],
        quiz: [
          { prompt: "Which pattern has no word-level pitch drop?", options: ["Heiban", "Atamadaka", "Nakadaka", "Odaka"], answer: 0, explanation: "Heiban rises at the start and has no word-level drop in this basic model." },
          { prompt: "Why add が when comparing heiban and odaka?", options: ["It makes the word plural", "It lets you hear whether the pitch drops after the word", "It makes the first beat longer"], answer: 1, explanation: "が stays high after heiban but is low after odaka." },
          { prompt: "Where does the pitch drop in atamadaka?", options: ["Just after the first beat", "It does not drop", "Only after the following が"], answer: 0, explanation: "Start high, then drop after the first beat." },
          { prompt: "Where does the pitch drop in nakadaka?", options: ["Inside the word, with part of the word still to come", "Nowhere in or after the word", "Before the word begins"], answer: 0, explanation: "The drop happens in the middle of the word." },
          { prompt: "What happens in the basic odaka pattern?", options: ["The last beat of the word is high, then the following particle is low", "The pitch always drops after the first beat", "Every beat stays low"], answer: 0, explanation: "Listen to the following particle to hear the drop after the word." },
        ],
      },
      {
        slug: "phrases", title: "From word to phrase", duration: "9 min", summary: "Listen for familiar pitch patterns as words join into sentences.",
        sections: [
          { title: "The melody of a whole phrase", body: ["When you join words together, they do not sound like separate dictionary recordings. A short group of words may begin with a rise and gradually get lower as you speak.", "Keep listening for the important drops, rather than trying to hit an exact musical note. ‘High’ and ‘low’ describe the difference between parts of your own voice."], examples: [{"japanese": "あたらしい ほんです", "label": "atarashii hon desu", "note": "Say the words separately, then listen to how they fit together in a phrase."}] },
          { title: "Adding emphasis", body: ["Think of saying ‘I REALLY like ice cream’ in English. Your voice changes to draw attention to ‘really’. Japanese speakers also change their delivery to highlight information, often using a bigger rise and fall or changing how they group the words.", "That added emphasis is different from a word's usual pitch pattern. Get comfortable with the word on its own first, then listen to how it sounds in a sentence."], callout: "Pitch diagrams are a guide to higher and lower sounds. You do not need to sing exact notes." },
        ],
        quiz: [
          { prompt: "What do pitch diagrams help you see?", options: ["Exact musical notes", "Which parts sound higher or lower", "Only how loud to speak"], answer: 1, explanation: "Follow the changes in voice height rather than aiming for a particular note." },
          { prompt: "Is adding emphasis the same as a word's usual pitch accent?", options: ["Yes", "No"], answer: 1, explanation: "Emphasis highlights information. A word also has its own usual pitch pattern." },
          { prompt: "What can happen over a short phrase?", options: ["The voice gradually gets lower overall", "Every word loses its usual pitch pattern", "Every word has to start on the same musical note"], answer: 0, explanation: "A phrase can gradually get lower while you still hear the important pitch drops." },
          { prompt: "How might a speaker draw attention to information?", options: ["Use a bigger pitch change or group the words differently", "Change which kana exist", "Add beats to every word"], answer: 0, explanation: "The speaker can change the melody or grouping of a phrase for emphasis." },
          { prompt: "What should you practise before adding emphasis?", options: ["The word's usual pitch pattern", "English word stress", "One exact musical note"], answer: 0, explanation: "Start with the word's usual rise and fall, then listen to it in sentences." },
        ],
      },
    ],
  },
  {
    slug: "kana", index: "04", japanese: "かな", title: "Kana", color: "gold",
    description: "Begin reading Japanese with hiragana and katakana.",
    lessons: [
      {
        slug: "how-kana-works", title: "How kana works", duration: "7 min", summary: "Meet hiragana and katakana, the two sets of characters you will learn first.",
        sections: [
          { title: "Different shapes, familiar sounds", body: ["Hiragana and katakana are two ways to write the same basic set of sounds. For example, あ and ア both represent a.", "You will see hiragana in many Japanese words and grammatical endings. Katakana often appears in words borrowed from other languages, foreign names and sound effects. Learn to recognise both sets, one small group at a time."], examples: [{"japanese": "あ / ア", "label": "a", "note": "Two shapes for the same a sound."}] },
          { title: "Small marks can change the sound", body: ["The two small strokes ゛ are called dakuten. They change sounds such as ka to ga: か → が. The small circle ゜ is called handakuten and turns the h row into p sounds, as in は → ぱ.", "Small ゃ, ゅ and ょ join with the kana before them to make sounds such as kya. Small っ tells you to hold the next consonant, and ー in katakana tells you to hold the vowel before it."], callout: "Learn っ and ー inside words, where you can hear what they do." },
          { title: "Read the timing marks with the word", body: ["In カット, small ッ tells you to hold before t: ka — hold — to. In コート, ー tells you to keep the o going: ko-o-to.", "Both words have three beats, but the extra beat is used differently. Neither ッ nor ー has a separate sound you can read on its own."], examples: [{"japanese": "カット / コート", "label": "katto / kōto", "note": "Hold before t in カット; hold the o sound in コート."}] },
          { title: "Small vowels help write borrowed words", body: ["Katakana sometimes combines with a small vowel to write sounds outside the basic kana chart. フ with small ァ makes ファ (fa), テ with small ィ makes ティ (ti), and チ with small ェ makes チェ (che).", "Keep each combination together as one beat. Learn it inside a word, so you can hear how the sounds join."], examples: [{"japanese": "ファイル", "label": "fairu", "note": "ファ represents fa in ‘file’."}, {"japanese": "ティー", "label": "tī", "note": "ティ is ti; ー extends its vowel."}, {"japanese": "チェス", "label": "chesu", "note": "チェ represents che in ‘chess’."}] },
        ],
        quiz: [
          { prompt: "What do hiragana and katakana mainly represent?", options: ["Different languages", "The same basic sounds", "Only pitch patterns"], answer: 1, explanation: "The shapes are different, but あ and ア, for example, both represent a." },
          { prompt: "How should you learn to read small っ?", options: ["As a separate letter with its own sound", "Inside a word with the following consonant", "By skipping it"], answer: 1, explanation: "Read it with the next consonant so you know what to hold." },
          { prompt: "What can the two small strokes ゛ do?", options: ["Change ka to ga, for example", "Make every vowel long", "Turn katakana into hiragana"], answer: 0, explanation: "The marks change the consonant sound, as in か → が." },
          { prompt: "What does ー tell you to do in a katakana word?", options: ["Hold the previous vowel for one more beat", "Hold the next consonant", "Pause between words"], answer: 0, explanation: "Keep the vowel before ー going for an extra beat." },
          { prompt: "How should you read ファ in ファイル?", options: ["As one combined fa sound", "As fu and then a separate a", "As a silent mark"], answer: 0, explanation: "フ and small ァ join together to make fa." },
        ],
      },
      {
        slug: "hiragana-path", title: "Learning hiragana", duration: "guided", summary: "Learn a small group, then keep earlier characters fresh with practice.",
        sections: [
          { title: "Read it, then find it", body: ["Start by looking at each character and listening to its sound. In recognition practice, you see the kana and give its reading. In recall practice, you see the reading and choose the matching kana.", "You meet a new group in order first, then practise it in a shuffled order with some characters you have already learned. Get each new character right twice in a row before moving from recognition to recall. Do the same in recall to complete the group.", "Later, the Test page brings characters back for review. Reading a character and remembering its shape are tracked separately, so you can practise each skill."], callout: "Start with あ・い・う・え・お. Once you can read them, practise choosing the right character from its reading." },
        ],
        quiz: [
          { prompt: "Are reading a kana and recalling its shape tracked as one skill?", options: ["Yes", "No"], answer: 1, explanation: "They are tracked separately because one direction may feel easier than the other." },
          { prompt: "What happens to kana you learned earlier?", options: ["They disappear", "They return in mixed practice and scheduled reviews", "They reset when you open a new group"], answer: 1, explanation: "Coming back to older characters helps you remember them." },
          { prompt: "When do you start recall for a new group?", options: ["Before trying recognition", "After getting each new kana right twice in a row in recognition", "Only after learning all hiragana and katakana"], answer: 1, explanation: "First practise reading the characters, then choosing their shapes." },
          { prompt: "When is a group complete?", options: ["As soon as you open it", "After getting each new kana right twice in a row in recall too", "After any one review"], answer: 1, explanation: "Complete both recognition and recall for the group." },
          { prompt: "Where do you go for scheduled reviews?", options: ["They are always shown inside each lesson", "The Test page", "Only the vowel group"], answer: 1, explanation: "Use the kana page to learn and practise groups, and the Test page for scheduled reviews." },
        ],
      },
      {
        slug: "katakana-path", title: "Learning katakana", duration: "guided", summary: "Learn new shapes for familiar sounds, then try them in borrowed words.",
        sections: [
          { title: "Same sounds, new shapes", body: ["Katakana follows the same basic sound order as hiragana. You are learning another set of shapes for sounds you have already met.", "Some characters look very similar, especially シ and ツ, or ソ and ン. Compare the angle and position of the short strokes, and notice which way the longer stroke runs. Take these pairs slowly."], examples: [{"japanese": "シ・ツ・ソ・ン", "label": "shi · tsu · so · n", "note": "Compare where the short strokes sit and which way they point."}] },
        ],
        quiz: [
          { prompt: "What changes between あ and ア?", options: ["The basic sound", "The shape and where you usually see it", "The number of beats"], answer: 1, explanation: "Both represent a, but they belong to different sets of characters." },
          { prompt: "What helps you tell similar katakana apart?", options: ["Guessing from English letters", "Looking at the direction and position of the strokes", "Changing the pitch"], answer: 1, explanation: "Small differences in the strokes help you recognise each character." },
          { prompt: "Which pair is useful for practising stroke differences?", options: ["シ and ツ", "ア and あ", "ー and っ"], answer: 0, explanation: "Look closely at where the short strokes sit in シ and ツ." },
          { prompt: "Where will you often see katakana?", options: ["Borrowed words and foreign names", "Only verb endings", "Only pitch diagrams"], answer: 0, explanation: "Katakana is common in borrowed words, foreign names and sound effects." },
          { prompt: "Why can you learn katakana in the same sound order as hiragana?", options: ["They share the same basic sounds", "Katakana has no sounds", "Their shapes are identical"], answer: 0, explanation: "You can use the sounds you already know while learning the new shapes." },
        ],
      },
    ],
  },
];

export const trackBySlug = Object.fromEntries(curriculum.map((track) => [track.slug, track]));

export function getLesson(trackSlug: string, lessonSlug: string) {
  return trackBySlug[trackSlug]?.lessons.find((lesson) => lesson.slug === lessonSlug);
}
