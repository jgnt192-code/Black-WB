import { afterEach, describe, expect, test } from "bun:test";
import games, { normalizeAnswer, PUZZLES } from "../src/plugins/games/games.js";

const makeMessage = (chat = "chat-1", sender = "player-1") => {
    const replies = [];
    return {
        chat,
        sender,
        replies,
        reply: async (text) => {
            replies.push(text);
        },
    };
};

const runCommand = (m, command, text = "") =>
    games(m, {
        command,
        text,
        args: text ? text.split(/\s+/u) : [],
        usedPrefix: ".",
    });

afterEach(async () => {
    await games.cleanup();
});

describe("WhatsApp games commands", () => {
    test("lists every game and supporting command", async () => {
        const m = makeMessage();
        await runCommand(m, "لعبة");

        expect(m.replies[0]).toContain(".فكك");
        expect(m.replies[0]).toContain(".انمي");
        expect(m.replies[0]).toContain(".فزورة");
        expect(m.replies[0]).toContain(".جاوب");
    });

    test("starts a word scramble, checks answers, and awards a point", async () => {
        const m = makeMessage();
        const originalRandom = Math.random;
        Math.random = () => 0;

        try {
            await runCommand(m, "فكك");
            expect(m.replies[0]).toContain("تفكيك الكلمات");
            expect(m.replies[0]).toContain(".جاوب");

            await runCommand(m, "جاوب", "قلم");
            expect(m.replies[1]).toBe("خطأ");

            await runCommand(m, "جاوب", "كِتاب");
            expect(m.replies[2]).toContain("إجابة صحيحة");

            await runCommand(m, "نقاط");
            expect(m.replies[3]).toContain("1");
        } finally {
            Math.random = originalRandom;
        }
    });

    test("accepts the تفكيك alias for the word game", async () => {
        const m = makeMessage();
        const originalRandom = Math.random;
        Math.random = () => 0;

        try {
            await runCommand(m, "تفكيك");
            expect(m.replies[0]).toContain("تفكيك الكلمات");
        } finally {
            Math.random = originalRandom;
        }
    });

    test("supports anime and riddle rounds with hints", async () => {
        const m = makeMessage();
        const originalRandom = Math.random;
        Math.random = () => 0;

        try {
            await runCommand(m, "انمي");
            expect(m.replies[0]).toContain("( القصة أنمي )");
            expect(m.replies[0]).not.toContain(".جاوب");
            expect(m.replies[0]).not.toContain("بدأت لعبة");
            await runCommand(m, "تلميح");
            expect(m.replies[1]).toContain("تلميح:");
            await runCommand(m, "جاوب", "لوفي");
            expect(m.replies[2]).toContain("إجابة صحيحة");
            expect(m.replies[2]).toContain("نقطة");
            expect(m.replies[3]).toContain("( القصة ");
            expect(m.replies[3]).not.toBe(m.replies[0]);

            const riddle = makeMessage("riddle-chat");
            await runCommand(riddle, "فزورة");
            expect(riddle.replies[0]).toContain("الفوازير");
            await runCommand(riddle, "جاوب", "الحفرة");
            expect(riddle.replies[1]).toContain("إجابة صحيحة");
        } finally {
            Math.random = originalRandom;
        }
    });

    test("receives plain-text answers during an anime round", async () => {
        const m = makeMessage("anime-plain-answer-chat", "player-1");
        const originalRandom = Math.random;
        Math.random = () => 0;

        try {
            await runCommand(m, "انمي");
            expect(m.replies[0]).toContain("أرسل اسم الشخصية مباشرةً");

            m.text = "اسم غير صحيح";
            await games.all(m);
            expect(m.replies[1]).toBe("خطأ");

            m.text = "لوفي";
            await games.all(m);
            expect(m.replies[2]).toContain("إجابة صحيحة");
            expect(m.replies[3]).toContain("( القصة ");
        } finally {
            Math.random = originalRandom;
        }
    });

    test("leaves prefixed anime answers to the normal command handler", async () => {
        const m = makeMessage("anime-prefixed-answer-chat", "player-1");
        const originalRandom = Math.random;
        Math.random = () => 0;

        try {
            await runCommand(m, "انمي");
            m.text = ".جاوب لوفي";

            await games.all(m);
            expect(m.replies).toHaveLength(1);

            await runCommand(m, "جاوب", "لوفي");
            expect(m.replies[1]).toContain("إجابة صحيحة");
        } finally {
            Math.random = originalRandom;
        }
    });

    test("accepts both a short and a full character name", async () => {
        const m = makeMessage("luffy-chat", "player-1");
        const fullName = makeMessage("luffy-full-name-chat", "player-1");
        const originalRandom = Math.random;
        Math.random = () => 0;

        try {
            await runCommand(m, "انمي");
            await runCommand(m, "جاوب", "Luffy");
            expect(m.replies[1]).toContain("إجابة صحيحة");

            await runCommand(fullName, "انمي");
            await runCommand(fullName, "جاوب", "Monkey D. Luffy");
            expect(fullName.replies[1]).toContain("إجابة صحيحة");
        } finally {
            Math.random = originalRandom;
        }
    });

    test("includes manhwa and novel characters and accepts short names", async () => {
        const manhwaIndex = PUZZLES.anime.findIndex(
            (puzzle) => puzzle.category === "مانهوا"
        );
        const novelIndex = PUZZLES.anime.findIndex(
            (puzzle) => puzzle.category === "رواية"
        );
        expect(manhwaIndex).toBeGreaterThanOrEqual(0);
        expect(novelIndex).toBeGreaterThanOrEqual(0);

        const manhwa = makeMessage("manhwa-chat", "player-1");
        const novel = makeMessage("novel-chat", "player-1");
        const originalRandom = Math.random;

        try {
            Math.random = () => (manhwaIndex + 0.1) / PUZZLES.anime.length;
            await runCommand(manhwa, "انمي");
            expect(manhwa.replies[0]).toContain(
                `${PUZZLES.anime[manhwaIndex].prompt} ( القصة مانهوا )`
            );
            await runCommand(manhwa, "جاوب", "جين وو");
            expect(manhwa.replies[1]).toContain("إجابة صحيحة");
            expect(manhwa.replies[2]).toContain("( القصة ");

            Math.random = () => (novelIndex + 0.1) / PUZZLES.anime.length;
            await runCommand(novel, "انمي");
            expect(novel.replies[0]).toContain(
                `${PUZZLES.anime[novelIndex].prompt} ( القصة رواية )`
            );
            await runCommand(novel, "جاوب", "هاري");
            expect(novel.replies[1]).toContain("إجابة صحيحة");
            expect(novel.replies[2]).toContain("( القصة ");
        } finally {
            Math.random = originalRandom;
        }
    });

    test("accepts Arabic names for every character", async () => {
        const originalRandom = Math.random;

        try {
            for (let index = 0; index < PUZZLES.anime.length; index++) {
                const puzzle = PUZZLES.anime[index];
                const m = makeMessage(`arabic-answer-${index}`);
                Math.random = () => (index + 0.1) / PUZZLES.anime.length;

                await runCommand(m, "انمي");
                await runCommand(m, "جاوب", puzzle.answers[0]);

                expect(m.replies[1]).toContain("إجابة صحيحة");
                expect(m.replies[2]).toContain("( القصة ");
            }
        } finally {
            Math.random = originalRandom;
        }
    });

    test("accepts common Arabic spelling variants", async () => {
        const cases = [
            [3, "جوكو"],
            [4, "لايت ياجامي"],
            [6, "دوك جا"],
            [7, "تشا هي ان"],
        ];
        const originalRandom = Math.random;

        try {
            for (const [index, answer] of cases) {
                const m = makeMessage(`arabic-variant-${index}`);
                Math.random = () => (index + 0.1) / PUZZLES.anime.length;

                await runCommand(m, "انمي");
                await runCommand(m, "جاوب", answer);
                expect(m.replies[1]).toContain("إجابة صحيحة");
            }
        } finally {
            Math.random = originalRandom;
        }
    });

    test("allows three wrong answers per player and eliminates only that player", async () => {
        const firstPlayer = makeMessage("attempt-limit-chat", "player-1");
        const secondPlayer = makeMessage("attempt-limit-chat", "player-2");
        const originalRandom = Math.random;
        Math.random = () => 0;

        try {
            await runCommand(firstPlayer, "انمي");
            await runCommand(firstPlayer, "جاوب", "خطأ واحد");
            await runCommand(firstPlayer, "جاوب", "خطأ اثنان");
            await runCommand(firstPlayer, "جاوب", "خطأ ثلاثة");
            await runCommand(firstPlayer, "جاوب", "لوفي");

            expect(firstPlayer.replies.slice(1, 3)).toEqual(["خطأ", "خطأ"]);
            expect(firstPlayer.replies[3]).toBe("خطأ، انتهت محاولاتك.");
            expect(firstPlayer.replies[4]).toBe("انتهت محاولاتك.");

            await runCommand(secondPlayer, "جاوب", "لوفي");
            expect(secondPlayer.replies[0]).toContain("إجابة صحيحة");
            expect(secondPlayer.replies[1]).toContain("( القصة ");

            await runCommand(firstPlayer, "نقاط");
            expect(firstPlayer.replies[5]).toContain("0");

            await runCommand(firstPlayer, "جاوب", "ناروتو");
            expect(firstPlayer.replies[6]).toContain("إجابة صحيحة");
            await runCommand(firstPlayer, "نقاط");
            expect(firstPlayer.replies[8]).toContain("1");
        } finally {
            Math.random = originalRandom;
        }
    });

    test("normalizes Arabic diacritics, hamza forms, and Persian letters", () => {
        expect(normalizeAnswer("لَايْت يَاجامي")).toBe(
            normalizeAnswer("لايت ياجامي")
        );
        expect(normalizeAnswer("کیم")).toBe(normalizeAnswer("كيم"));
        expect(normalizeAnswer("سُؤَال")).toBe(normalizeAnswer("سوال"));
    });

    test("keeps one active round per chat and allows ending it", async () => {
        const first = makeMessage("shared-chat", "player-1");
        const second = makeMessage("shared-chat", "player-2");
        const originalRandom = Math.random;
        Math.random = () => 0;

        try {
            await runCommand(first, "فكك");
            await runCommand(second, "فزورة");
            expect(second.replies[0]).toContain("جولة");

            await runCommand(second, "انهاء");
            expect(second.replies[1]).toContain("إيقاف الجولة");
            await runCommand(second, "فزورة");
            expect(second.replies[2]).toContain("الفوازير");
        } finally {
            Math.random = originalRandom;
        }
    });

    test("isolates game sessions and scores between chats", async () => {
        const first = makeMessage("chat-a", "player-1");
        const second = makeMessage("chat-b", "player-1");
        const originalRandom = Math.random;
        Math.random = () => 0;

        try {
            await runCommand(first, "فكك");
            await runCommand(second, "جاوب", "كتاب");
            expect(second.replies[0]).toContain("لا توجد جولة نشطة");

            await runCommand(first, "جاوب", "كتاب");
            await runCommand(second, "نقاط");
            expect(second.replies[1]).toContain("0");
        } finally {
            Math.random = originalRandom;
        }
    });
});
