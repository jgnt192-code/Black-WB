/**
 * @file Forward a regular quoted message to the bot's own chat
 * @license Apache-2.0
 */

const hasViewOnce = (value, seen = new Set(), depth = 0) => {
    if (!value || typeof value !== "object" || seen.has(value) || depth > 8) return false;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
        if (/view.?once/i.test(key)) return true;
        if (hasViewOnce(child, seen, depth + 1)) return true;
    }
    return false;
};

const handler = async (m, { sock }) => {
    const quoted = m.quoted;
    if (!quoted) return m.reply("رد على رسالة عادية تريد حفظها.");
    if (hasViewOnce(quoted.vM?.message || quoted.mediaMessage || quoted)) {
        return m.reply("لا يمكن حفظ وسائط العرض لمرة واحدة.");
    }

    const ownJid = sock.decodeJid(sock.user?.id || sock.user?.lid || "");
    if (!ownJid) return m.reply("تعذّر تحديد محادثة البوت.");

    try {
        await quoted.forward(ownJid);
        return m.reply("أُرسلت الرسالة إلى محادثة البوت.");
    } catch (error) {
        global.logger?.error(error, "Save message failed");
        return m.reply("تعذّر حفظ الرسالة.");
    }
};

handler.help = ["save"];
handler.tags = ["tools"];
handler.command = /^save$/iu;

export default handler;
