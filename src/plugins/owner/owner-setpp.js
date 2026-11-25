/**
 * @file Update the bot profile picture
 * @license Apache-2.0
 */

const hasViewOnce = (value, seen = new Set(), depth = 0) => {
    if (!value || typeof value !== "object" || seen.has(value) || depth > 8) return false;
    seen.add(value);

    for (const [key, child] of Object.entries(value)) {
        if (/view.?once/i.test(key)) return true;
        if (child === true && /view.?once/i.test(key)) return true;
        if (hasViewOnce(child, seen, depth + 1)) return true;
    }
    return false;
};

const handler = async (m, { sock }) => {
    const media = m.quoted || m;
    if (hasViewOnce(media.vM?.message || media.message || media.mediaMessage)) {
        return m.reply("لا يمكن استخدام وسائط العرض لمرة واحدة لهذا الأمر.");
    }

    const type = media.mediaType || media.mtype;
    if (type !== "imageMessage") {
        return m.reply("أرفق صورة أو رد على صورة ثم استخدم الأمر.");
    }

    try {
        const buffer = await media.download?.();
        if (!buffer?.length) return m.reply("تعذّر تنزيل الصورة.");
        if (buffer.length > 6 * 1024 * 1024) {
            return m.reply("حجم الصورة يجب ألا يتجاوز 6 ميغابايت.");
        }

        const botJid = sock.decodeJid(sock.user?.lid || sock.user?.id);
        if (!botJid) return m.reply("تعذّر تحديد حساب البوت.");
        await sock.updateProfilePicture(botJid, buffer);
        return m.reply("تم تحديث صورة حساب البوت.");
    } catch (error) {
        global.logger?.error(error, "Profile picture update failed");
        return m.reply("تعذّر تحديث الصورة. تحقق من صيغة الملف وحاول مجددًا.");
    }
};

handler.help = ["setpp", "pp"];
handler.tags = ["owner"];
handler.command = /^(setpp|pp)$/iu;
handler.owner = true;
handler.silentUnauthorized = true;

export default handler;
