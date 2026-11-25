const parseRepeatInterval = (value) => {
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
    const isSeconds = /^(?:s|sec|secs|second|seconds|ث)/iu.test(match[2] || "");
    const intervalMs = amount * (isSeconds ? 1000 : 60000);

    return intervalMs >= 1000 && intervalMs <= 3600000 ? intervalMs : null;
};

const MAX_MESSAGES = 999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999;
const DELAY = 3000;

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

『𖤐』 𝑻𝑯𝑬 𝑩𝑳𝑨𝑪𝑲 𝑻𝑯𝑹𝑶𝑵𝑬

   𝑵𝑶 𝑪𝑹𝑶𝑾𝑵 𝑨𝑩𝑶𝑽𝑬 𝑼𝑺.
         𝑵𝑶 𝑴𝑬𝑹𝑪𝒀. 🖤`;

const normalizePhone = (value) =>
    String(value || "").replace(/\D/g, "");

const handler = async (m, { sock, isOwner }) => {
    if (!isOwner || m.isGroup) return;

    const raw = String(m.text || "")
        .trim()
        .replace(/^[/.!]\s*/u, "");

    const match = /^احوي\s+\+?([\d\s().-]{5,})\s+لول\s+(.+)$/iu.exec(raw);
    if (!match) return;

    const phone = normalizePhone(match[1]);
    const intervalMs = parseRepeatInterval(match[2]);

    if (phone.length < 5 || phone.length > 15 || !intervalMs) return;

    const matches = await sock.onWhatsApp(phone);

    const target = matches?.find(
        account => account?.exists && typeof account.jid === "string"
    );

    if (!target) {
        await m.reply("لم أعثر على حساب واتساب لهذا الرقم.");
        return;
    }

    await m.reply("تم التحقق من الرقم. استخدم إرسالاً واحداً أو اختباراً بموافقة المستلم.");
};

handler.help = ["احوي +رقم الهاتف لول <مدة>"];
handler.tags = ["owner"];
handler.owner = true;
handler.customPrefix = /^[/.!]?\s*احوي(?=\s|$)/iu;
handler.command = /(?:)/i;

export default handler;
