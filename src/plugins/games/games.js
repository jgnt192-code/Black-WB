import { ADDITIONAL_ANIME_PUZZLES } from "./anime-characters.js";

export const PUZZLES = {
    word: [
        {
            prompt: "رتّب الحروف: ب ك ا ت",
            answers: ["كتاب"],
            hint: "تقرأ فيه القصص والمعلومات.",
        },
        {
            prompt: "رتّب الحروف: س ة د ر م",
            answers: ["مدرسة"],
            hint: "مكان يتعلّم فيه الطلاب.",
        },
        {
            prompt: "رتّب الحروف: ذ ا ن ة ف",
            answers: ["نافذة"],
            hint: "تطلّ منها إلى الخارج.",
        },
        {
            prompt: "رتّب الحروف: ر ق م",
            answers: ["قمر"],
            hint: "يضيء السماء ليلًا.",
        },
        {
            prompt: "رتّب الحروف: ت ة ك م ب",
            answers: ["مكتبة"],
            hint: "مكان مليء بالكتب.",
        },
    ],
    anime: [
        {
            category: "أنمي",
            prompt: "قرصان يرتدي قبعة من القش ويحلم بأن يصبح ملك القراصنة. من هو؟",
            answers: [
                "لوفي",
                "مونكي دي لوفي",
                "مونكي دي لوفى",
                "لوفي دي مونكي",
                "luffy",
                "monkey d luffy",
            ],
            hint: "اسمه يبدأ بحرف اللام.",
        },
        {
            category: "أنمي",
            prompt: "نينجا من كونوها يحلم بأن يصبح الهوكاغي. من هو؟",
            answers: [
                "ناروتو",
                "ناروتو اوزوماكي",
                "اوزوماكي ناروتو",
                "ناروتو اوزماكي",
                "naruto",
                "naruto uzumaki",
            ],
            hint: "اسمه ناروتو.",
        },
        {
            category: "أنمي",
            prompt: "صياد شياطين يحمل سيفًا أسود ويسعى لإنقاذ أخته نيزوكو. من هو؟",
            answers: [
                "تانجيرو",
                "كامادو تانجيرو",
                "تانجيرو كامادو",
                "tanjiro",
                "tanjiro kamado",
            ],
            hint: "اسمه تانجيرو.",
        },
        {
            category: "أنمي",
            prompt: "محارب سايان يحب القتال والطعام، وشعره يقف إلى الأعلى. من هو؟",
            answers: [
                "غوكو",
                "جوكو",
                "سون غوكو",
                "سون جوكو",
                "كاكاروتو",
                "goku",
                "son goku",
                "kakarot",
            ],
            hint: "يُعرف أيضًا باسم كاكاروتو.",
        },
        {
            category: "أنمي",
            prompt: "طالب يملك دفترًا يقتل من يُكتب اسمه فيه. من هو؟",
            answers: [
                "لايت",
                "لايت ياغامي",
                "لايت ياجامي",
                "ياغامي لايت",
                "ياجامي لايت",
                "light",
                "light yagami",
            ],
            hint: "اسمه الأول يعني الضوء بالإنجليزية.",
        },
        {
            category: "مانهوا",
            prompt: "صياد بدأ من أضعف رتبة، ثم صار أقوى صياد في عالمه. من هو؟",
            answers: [
                "جين وو",
                "سونغ جين وو",
                "سونغ جينوو",
                "سونج جين وو",
                "جينوو",
                "sung jinwoo",
                "sung jin woo",
                "jinwoo",
                "jin woo",
            ],
            hint: "بطل مانهوا Solo Leveling.",
        },
        {
            category: "مانهوا",
            prompt: "قارئ وحيد يعرف نهاية العالم لأنه قرأ روايتها كاملة. من هو؟",
            answers: [
                "دوكجا",
                "كيم دوكجا",
                "كيم دوك جا",
                "دوك جا",
                "kim dokja",
                "dokja",
            ],
            hint: "بطل Omniscient Reader's Viewpoint.",
        },
        {
            category: "مانهوا",
            prompt: "صياد من الرتبة S يستخدم السلاسل وسيفًا، ويصبح شريكًا لجين وو. من هي؟",
            answers: [
                "تشا هاي ان",
                "تشا هاي إن",
                "تشا هي ان",
                "هاي إن",
                "هاي ان",
                "cha hae in",
                "cha hae-in",
            ],
            hint: "اسمها يبدأ بتشا.",
        },
        {
            category: "رواية",
            prompt: "فتى يتلقى رسالة من مدرسة للسحر ويحمل ندبة على شكل برق. من هو؟",
            answers: ["هاري", "هاري بوتر", "هاريّ بوتر", "harry", "harry potter"],
            hint: "اسمه هاري.",
        },
        {
            category: "رواية",
            prompt: "محقق مشهور في لندن يحل القضايا بملاحظة التفاصيل والاستنتاج. من هو؟",
            answers: [
                "شيرلوك",
                "شيرلوك هولمز",
                "هولمز",
                "شرلوك",
                "sherlock",
                "sherlock holmes",
            ],
            hint: "يسكن في شارع بيكر.",
        },
        {
            category: "رواية",
            prompt: "وريث يواجه قدره في أراكيس، كوكب الرمال والتوابل. من هو؟",
            answers: [
                "بول",
                "بول أتريدس",
                "بول اتريدس",
                "بول أترِيدس",
                "paul",
                "paul atreides",
            ],
            hint: "بطل رواية Dune.",
        },
        {
            category: "رواية",
            prompt: "هوبيت ينطلق من الشاير ويحمل الخاتم إلى موردور. من هو؟",
            answers: [
                "فرودو",
                "فرودو باغنز",
                "فرودو باجنز",
                "فرودو باغينز",
                "فرودو باجينز",
                "frodo",
                "frodo baggins",
            ],
            hint: "اسمه يبدأ بحرف الفاء.",
        },
        ...ADDITIONAL_ANIME_PUZZLES,
    ],
    riddle: [
        {
            prompt: "شيء كلما أخذت منه كبر. ما هو؟",
            answers: ["الحفرة", "حفرة"],
            hint: "تجده في الأرض.",
        },
        {
            prompt: "له أسنان ولا يعض. ما هو؟",
            answers: ["المشط", "مشط"],
            hint: "تستخدمه لترتيب الشعر.",
        },
        {
            prompt: "يكتب ولا يقرأ. ما هو؟",
            answers: ["القلم", "قلم"],
            hint: "تحمله في يدك عند الكتابة.",
        },
        {
            prompt: "بيت بلا أبواب ولا نوافذ، وفي داخله شيء أصفر. ما هو؟",
            answers: ["البيضة", "بيضة"],
            hint: "يخرج منها الكتكوت.",
        },
        {
            prompt: "له مدن بلا بيوت، وأنهار بلا ماء. ما هو؟",
            answers: ["الخريطة", "خريطة"],
            hint: "تساعدك على معرفة الطرق.",
        },
    ],
};

const GAME_NAMES = {
    word: "تفكيك الكلمات",
    anime: "تخمين شخصية من أنمي أو مانهوا أو رواية",
    riddle: "الفوازير",
};

const activeGames = new Map();
const scores = new Map();

export function normalizeAnswer(value) {
    return String(value ?? "")
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .replace(/ـ/gu, "")
        .replace(/[أإآٱ]/gu, "ا")
        .replace(/ى/gu, "ي")
        .replace(/ؤ/gu, "و")
        .replace(/ئ/gu, "ي")
        .replace(/ک/gu, "ك")
        .replace(/ی/gu, "ي")
        .replace(/ة/gu, "ه")
        .toLocaleLowerCase()
        .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function getChatId(m) {
    return m.chat || m.sender || "unknown-chat";
}

function getPlayerId(m) {
    return m.sender || m.key?.participant || "unknown-player";
}

function getScore(chatId, playerId) {
    return scores.get(chatId)?.get(playerId) || 0;
}

function addPoint(chatId, playerId) {
    let chatScores = scores.get(chatId);
    if (!chatScores) {
        chatScores = new Map();
        scores.set(chatId, chatScores);
    }
    chatScores.set(playerId, getScore(chatId, playerId) + 1);
}

function selectPuzzle(gameType, previousPuzzle = null) {
    const puzzles = PUZZLES[gameType] || [];
    const candidates = previousPuzzle
        ? puzzles.filter((puzzle) => puzzle !== previousPuzzle)
        : puzzles;
    const available = candidates.length ? candidates : puzzles;
    return available[Math.floor(Math.random() * available.length)];
}

function formatAnimeQuestion(puzzle) {
    return `${puzzle.prompt} ( القصة ${puzzle.category} )\n\nأرسل اسم الشخصية مباشرةً للإجابة.`;
}

function createActiveGame(type, puzzle) {
    return {
        type,
        puzzle,
        startedAt: Date.now(),
        attempts: new Map(),
        eliminatedPlayers: new Set(),
    };
}

function hasCommandPrefix(text, prefix) {
    const configuredPrefixes =
        prefix == null ? [/^[/!.]/u] : Array.isArray(prefix) ? prefix : [prefix];

    return configuredPrefixes.some((candidate) => {
        if (candidate instanceof RegExp) {
            const flags = candidate.flags.replace(/[gy]/gu, "");
            return new RegExp(candidate.source, flags).test(text);
        }

        return typeof candidate === "string" && candidate.length > 0
            ? text.startsWith(candidate)
            : false;
    });
}

async function submitAnswer(m, currentGame, answerText, prefix = ".") {
    const chatId = getChatId(m);
    const playerId = getPlayerId(m);

    if (!answerText) {
        return m.reply(`اكتب إجابتك بعد الأمر. مثال: ${prefix}جاوب كتاب`);
    }
    if (currentGame.eliminatedPlayers.has(playerId)) {
        return m.reply("انتهت محاولاتك.");
    }

    const guess = normalizeAnswer(answerText);
    const correct = currentGame.puzzle.answers.some(
        (answer) => normalizeAnswer(answer) === guess
    );

    if (!correct) {
        const attempts = (currentGame.attempts.get(playerId) || 0) + 1;
        currentGame.attempts.set(playerId, attempts);
        if (attempts >= 3) {
            currentGame.eliminatedPlayers.add(playerId);
            return m.reply("خطأ، انتهت محاولاتك.");
        }
        return m.reply("خطأ");
    }

    addPoint(chatId, playerId);
    if (currentGame.type === "anime") {
        const nextPuzzle = selectPuzzle(currentGame.type, currentGame.puzzle);
        activeGames.set(chatId, createActiveGame(currentGame.type, nextPuzzle));
        await m.reply("إجابة صحيحة! حصلت على نقطة.");
        return m.reply(formatAnimeQuestion(nextPuzzle));
    }

    activeGames.delete(chatId);
    return m.reply(`إجابة صحيحة! الحل هو ${currentGame.puzzle.answers[0]}. حصلت على نقطة.`);
}

const handler = async (m, { command, text, args = [], usedPrefix = "." }) => {
    const chatId = getChatId(m);
    const playerId = getPlayerId(m);
    const normalizedCommand = String(command || "").toLocaleLowerCase();
    const answerText = String(text || args.join(" ")).trim();
    const prefix = usedPrefix || ".";

    if (/^(?:game|games|لعبة|العاب|ألعاب)$/iu.test(normalizedCommand)) {
        return m.reply(
            [
                "ألعاب البوت:",
                `${prefix}فكك أو ${prefix}تفكيك — رتّب الحروف`,
                `${prefix}انمي — خمّن شخصية من أنمي أو مانهوا أو رواية`,
                `${prefix}فزورة — حلّ فزورة`,
                `${prefix}جاوب <إجابتك> — أرسل الحل`,
                `${prefix}تلميح — اطلب تلميحًا`,
                `${prefix}نقاط — اعرض نقاطك`,
                `${prefix}انهاء — أوقف الجولة`,
            ].join("\n")
        );
    }

    const gameType = {
        فكك: "word",
        تفكيك: "word",
        كلمات: "word",
        unscramble: "word",
        انمي: "anime",
        شخصية: "anime",
        anime: "anime",
        فزورة: "riddle",
        لغز: "riddle",
        riddle: "riddle",
    }[normalizedCommand];

    if (gameType) {
        const currentGame = activeGames.get(chatId);
        if (currentGame) {
            return m.reply(
                `هناك جولة ${GAME_NAMES[currentGame.type]} قائمة بالفعل. أجب بـ ${prefix}جاوب أو أوقفها بـ ${prefix}انهاء.`
            );
        }

        const puzzles = PUZZLES[gameType];
        const puzzle = selectPuzzle(gameType);
        activeGames.set(chatId, createActiveGame(gameType, puzzle));

        if (gameType === "anime") {
            return m.reply(formatAnimeQuestion(puzzle));
        }

        return m.reply(
            `بدأت لعبة ${GAME_NAMES[gameType]}!\n${puzzle.prompt}\n\nأرسل الحل هكذا: ${prefix}جاوب <إجابتك>\nللتلميح: ${prefix}تلميح`
        );
    }

    if (/^(?:جاوب|answer)$/iu.test(normalizedCommand)) {
        const currentGame = activeGames.get(chatId);
        if (!currentGame) {
            return m.reply(`لا توجد جولة نشطة. اكتب ${prefix}لعبة لعرض الألعاب.`);
        }
        return submitAnswer(m, currentGame, answerText, prefix);
    }

    if (/^(?:تلميح|hint)$/iu.test(normalizedCommand)) {
        const currentGame = activeGames.get(chatId);
        if (!currentGame) {
            return m.reply(`لا توجد جولة نشطة. اكتب ${prefix}لعبة لبدء واحدة.`);
        }
        return m.reply(`تلميح: ${currentGame.puzzle.hint}`);
    }

    if (/^(?:نقاط|score)$/iu.test(normalizedCommand)) {
        return m.reply(`نقاطك في هذه المحادثة: ${getScore(chatId, playerId)}`);
    }

    if (/^(?:انهاء|إنهاء|وقف_اللعبة|cancelgame)$/iu.test(normalizedCommand)) {
        if (!activeGames.has(chatId)) {
            return m.reply("لا توجد جولة نشطة لإيقافها.");
        }
        activeGames.delete(chatId);
        return m.reply("تم إيقاف الجولة. ابدأ لعبة جديدة في أي وقت.");
    }
};

handler.all = async function (m) {
    const answerText = String(m?.text || "").trim();
    if (!answerText || hasCommandPrefix(answerText, this?.prefix)) return;

    const currentGame = activeGames.get(getChatId(m));
    if (!currentGame || currentGame.type !== "anime") return;

    return submitAnswer(m, currentGame, answerText);
};

handler.help = [
    "لعبة",
    "فكك",
    "تفكيك",
    "انمي",
    "فزورة",
    "جاوب <إجابتك>",
    "تلميح",
    "نقاط",
    "انهاء",
];
handler.tags = ["games"];
handler.command =
    /^(?:game|games|لعبة|العاب|ألعاب|فكك|تفكيك|كلمات|unscramble|انمي|شخصية|anime|فزورة|لغز|riddle|جاوب|answer|تلميح|hint|نقاط|score|انهاء|إنهاء|وقف_اللعبة|cancelgame)$/iu;
handler.cleanup = async () => {
    activeGames.clear();
    scores.clear();
};

export default handler;
