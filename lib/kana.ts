export type KanaScript = "hiragana" | "katakana";
export type Direction = "recognition" | "recall";

export type KanaItem = {
  id: string;
  kana: string;
  romaji: string;
  aliases: string[];
  script: KanaScript;
  groupId: string;
};

export type KanaGroup = {
  id: string;
  script: KanaScript;
  label: string;
  eyebrow: string;
  note?: string;
  items: KanaItem[];
};

const aliases: Record<string, string[]> = {
  shi: ["si"], chi: ["ti"], tsu: ["tu"], fu: ["hu"], ji: ["zi"],
  sha: ["sya"], shu: ["syu"], sho: ["syo"], cha: ["tya", "cya"],
  chu: ["tyu", "cyu"], cho: ["tyo", "cyo"], ja: ["zya", "jya"],
  ju: ["zyu", "jyu"], jo: ["zyo", "jyo"],
};

type RawGroup = [string, string, string, Array<[string, string]>, string?];

const hiraganaRaw: RawGroup[] = [
  ["h-vowels", "Vowels", "The five anchors", [["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"]]],
  ["h-k", "K row", "Add a clean k", [["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"]]],
  ["h-s", "S row", "Notice shi", [["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"]]],
  ["h-t", "T row", "Two useful irregulars", [["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"]]],
  ["h-n", "N row", "Keep the vowel full", [["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"]]],
  ["h-h", "H row", "Meet fu", [["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"]]],
  ["h-m", "M row", "One smooth family", [["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"]]],
  ["h-y", "Y row", "Three open syllables", [["や", "ya"], ["ゆ", "yu"], ["よ", "yo"]]],
  ["h-r", "R row", "Use the Japanese tap", [["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"]]],
  ["h-w-n", "W row + ん", "Finish the basic set", [["わ", "wa"], ["を", "o"], ["ん", "n"]], "を is normally pronounced o in modern Japanese."],
  ["h-gz", "G & Z rows", "Add dakuten", [["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"], ["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"]]],
  ["h-d", "D row", "A compact voiced row", [["だ", "da"], ["ぢ", "ji"], ["づ", "zu"], ["で", "de"], ["ど", "do"]], "ぢ and づ are uncommon; spelling tells them apart from じ and ず."],
  ["h-bp", "B & P rows", "Dakuten and handakuten", [["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"], ["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"]]],
  ["h-yoon1", "Yōon I", "Small ゃゅょ combinations", [["きゃ", "kya"], ["きゅ", "kyu"], ["きょ", "kyo"], ["しゃ", "sha"], ["しゅ", "shu"], ["しょ", "sho"], ["ちゃ", "cha"], ["ちゅ", "chu"], ["ちょ", "cho"]]],
  ["h-yoon2", "Yōon II", "Complete the combinations", [["にゃ", "nya"], ["にゅ", "nyu"], ["にょ", "nyo"], ["ひゃ", "hya"], ["ひゅ", "hyu"], ["ひょ", "hyo"], ["みゃ", "mya"], ["みゅ", "myu"], ["みょ", "myo"], ["りゃ", "rya"], ["りゅ", "ryu"], ["りょ", "ryo"]]],
  ["h-yoon3", "Voiced yōon", "G, J, B and P combinations", [["ぎゃ", "gya"], ["ぎゅ", "gyu"], ["ぎょ", "gyo"], ["じゃ", "ja"], ["じゅ", "ju"], ["じょ", "jo"], ["びゃ", "bya"], ["びゅ", "byu"], ["びょ", "byo"], ["ぴゃ", "pya"], ["ぴゅ", "pyu"], ["ぴょ", "pyo"]]],
];

const kataChars: Record<string, string> = {
  あ:"ア",い:"イ",う:"ウ",え:"エ",お:"オ",か:"カ",き:"キ",く:"ク",け:"ケ",こ:"コ",
  さ:"サ",し:"シ",す:"ス",せ:"セ",そ:"ソ",た:"タ",ち:"チ",つ:"ツ",て:"テ",と:"ト",
  な:"ナ",に:"ニ",ぬ:"ヌ",ね:"ネ",の:"ノ",は:"ハ",ひ:"ヒ",ふ:"フ",へ:"ヘ",ほ:"ホ",
  ま:"マ",み:"ミ",む:"ム",め:"メ",も:"モ",や:"ヤ",ゆ:"ユ",よ:"ヨ",ら:"ラ",り:"リ",
  る:"ル",れ:"レ",ろ:"ロ",わ:"ワ",を:"ヲ",ん:"ン",が:"ガ",ぎ:"ギ",ぐ:"グ",げ:"ゲ",
  ご:"ゴ",ざ:"ザ",じ:"ジ",ず:"ズ",ぜ:"ゼ",ぞ:"ゾ",だ:"ダ",ぢ:"ヂ",づ:"ヅ",で:"デ",
  ど:"ド",ば:"バ",び:"ビ",ぶ:"ブ",べ:"ベ",ぼ:"ボ",ぱ:"パ",ぴ:"ピ",ぷ:"プ",ぺ:"ペ",ぽ:"ポ",
  ゃ:"ャ",ゅ:"ュ",ょ:"ョ",
};

function toGroup(raw: RawGroup, script: KanaScript): KanaGroup {
  const [id, label, eyebrow, pairs, note] = raw;
  const groupId = script === "hiragana" ? id : id.replace(/^h-/, "k-");
  return {
    id: groupId,
    script,
    label,
    eyebrow,
    note,
    items: pairs.map(([kana, romaji]) => {
      const shown = script === "hiragana" ? kana : [...kana].map((char) => kataChars[char] ?? char).join("");
      return { id: `${script}-${romaji}-${shown}`, kana: shown, romaji, aliases: aliases[romaji] ?? [], script, groupId };
    }),
  };
}

export const kanaGroups: KanaGroup[] = [
  ...hiraganaRaw.map((group) => toGroup(group, "hiragana")),
  ...hiraganaRaw.map((group) => toGroup(group, "katakana")),
];

export const kanaItems = kanaGroups.flatMap((group) => group.items);
export const kanaById = Object.fromEntries(kanaItems.map((item) => [item.id, item]));

export function normalizeRomaji(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[āâ]/g, "a")
    .replace(/[īî]/g, "i")
    .replace(/[ūû]/g, "u")
    .replace(/[ēê]/g, "e")
    .replace(/[ōô]/g, "o")
    .replace(/[^a-z]/g, "");
}

export function isRomajiAnswer(item: KanaItem, answer: string) {
  const normalized = normalizeRomaji(answer);
  return [item.romaji, ...item.aliases].some((candidate) => normalizeRomaji(candidate) === normalized);
}

export function findKanaItem(id: string) {
  return kanaById[id];
}

export function recallDisambiguation(item: KanaItem) {
  const sameReading = kanaItems.filter((candidate) => candidate.script === item.script && candidate.romaji === item.romaji);
  if (sameReading.length < 2) return undefined;
  const group = kanaGroups.find((candidate) => candidate.id === item.groupId);
  return `${group?.label ?? "This group"} spelling`;
}

export function seededShuffle<T>(items: T[], seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  }
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
