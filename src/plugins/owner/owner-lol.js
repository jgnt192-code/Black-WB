import {
    isRepeatLoopActive,
    startRepeatLoop,
    stopRepeatLoop,
    MAX_REPEAT_MESSAGES,
} from "../../lib/core/repeat-loop.js";

const REPEAT_TEXT = `𝑨𝑼𝑻𝑶 𝑱

『༺ 𝑩𝑳𝑨𝑪𝑲 𝑴𝑨𝑯𝑶𝑹𝑨 ༻』
𝑻𝑯𝑬 𝑫𝑨𝑹𝑲 𝑬𝑴𝑷𝑰𝑹𝑬

╭━━━『 🖤 𝑴𝑨𝑯𝑶𝑹𝑨 🖤 』━━━╮

⌯𖤐⌯ 𝑩【🦇】┋♛┋『𒈒』〘🥀〙
⌯𖤐⌯ 𝑳【🦇】┋♛┋『𒈒』〘🥀〙
⌯𖤐⌯ 𝑨【🦇】┋♛┋『𒈒』〘🥀〙
⌯𖤐⌯ 𝑪【🦇】┋♛┋『𒈒』〘🥀〙
⌯𖤐⌯ 𝑲【🦇】┋♛┋『𒈒』〘🥀〙

╰━━━━━━━━━━━━━━━━━━╯

╭━━━『 ♛ 𝑻𝑯𝑬 𝑳𝑬𝑮𝑨𝑪𝒀 ♛ 』━━━╮

⌯𖤐⌯ 𝑴【🖤】┋♛┋『𒈒』〘🥀〙
⌯𖤐⌯ 𝑨【🖤】┋♛┋『𒈒』〘🥀〙
⌯𖤐⌯ 𝑯【🖤】┋♛┋『𒈒』〘🥀〙
⌯𖤐⌯ 𝑶【🖤】┋♛┋『𒈒』〘🥀〙
⌯𖤐⌯ 𝑹【🖤】┋♛┋『𒈒』〘🥀〙
⌯𖤐⌯ 𝑨【🖤】┋♛┋『𒈒』〘🥀〙

╰━━━━━━━━━━━━━━━━━━╯

↫ 🥀 ↬

   𝑻𝑯𝑬 𝑩𝑳𝑨𝑪𝑲 𝑫𝒀𝑵𝑨𝑺𝑻𝒀

『𝑾𝑬 𝑫𝑶𝑵'𝑻 𝑭𝑶𝑳𝑳𝑶𝑾.
𝑾𝑬 𝑹𝑼𝑳𝑬.』

➥ 𝑳𝑶𝑹𝑫 ⟺ 𝑩𝑳𝑨𝑪𝑲 𝑴𝑨𝑯𝑶𝑹𝑨

『༴̤🖤⋆̤𖤐』⇣؍.َِ

╭──────『 𝑻𝑯𝑬 𝑪𝑹𝑶𝑾𝑵 』──────╮

➥ 𝑹𝑼𝑳𝑬 𝑰𝑵 𝑺𝑰𝑳𝑬𝑵𝑪𝑬
➥ 𝑺𝑻𝑨𝑵𝑫 𝑰𝑵 𝑺𝑯𝑨𝑫𝑶𝑾𝑺
➥ 𝑵𝑬𝑽𝑬𝑹 𝑩𝑶𝑾 𝑫𝑶𝑾𝑵

╰────────────────────────╯

『𖤐』 𝑻𝑯𝑬 𝑩𝑳𝑨𝑪𝑲 𝑫𝑯𝑹𝑶𝑵𝑬

   𝑵𝑶 𝑪𝑹𝑶𝑾𝑵 𝑨𝑩𝑶𝑽𝑬 𝑼𝑺.
         𝑵𝑶 𝑴𝑬𝑹𝑪𝒀. 🖤`;

export function parseRepeatInterval(value) {
    if (typeof value !== "string") return null;

    const normalized = value
        .trim()
        .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
    const match =
        /^(\d{1,3})\s*(s|sec|secs|second|seconds|ث|ثانية|ثواني|ثوان|m|min|mins|minute|minutes|دقيقة|دقائق)?$/iu.exec(
            normalized
        );
    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2] || "";
    const isSeconds = /^(?:s|sec|secs|second|seconds|ث)/iu.test(unit);
    const intervalMs = amount * (isSeconds ? 1000 : 60000);

    if (intervalMs < 1000 || intervalMs > 3600000) return null;
    return intervalMs;
}

export function parseRepeatCommand(value) {
    if (typeof value !== "string") return null;

    const match = /^[/.!]?\s*(?:لول|lol|loop)(?=\s|$)(?:\s+([\s\S]*))?$/iu.exec(
        value.trim()
    );
    return match ? (match[1] || "").trim() : null;
}

const isStopCommand = (value) =>
    /^(?:قف|وقف|إيقاف|stop|off)$/iu.test(value.trim());

const handler = async (m, { sock, args, text, isOwner }) => {
    if (!isOwner) return;

    const input =
        parseRepeatCommand(m.text) ??
        (typeof text === "string" && text.trim()
            ? text.trim()
            : Array.isArray(args)
              ? args.join(" ").trim()
              : "");

    if (isStopCommand(input)) {
        stopRepeatLoop();
        return;
    }

    if (!input || isRepeatLoopActive()) return;

    const intervalMs = parseRepeatInterval(input);
    if (!intervalMs) return;

    startRepeatLoop({
        sock,
        chat: m.chat,
        text: REPEAT_TEXT,
        intervalMs,
        maxMessages: MAX_REPEAT_MESSAGES,
    });
};

handler.help = ["لول <مدة>", "lol <مدة>", "loop <مدة>", "لول قف"];
handler.tags = ["owner"];
handler.owner = true;
handler.customPrefix = /^[/.!]?\s*(?:لول|lol|loop)(?=\s|$)/iu;
handler.command = /(?:)/i;

export default handler;
