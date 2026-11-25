/**
 * @file Group status message command handler
 * @module plugins/owner/groupstatus
 * @license Apache-2.0
 * @author Naruya Izumi
 */

let handler = async (m, { sock, usedPrefix, command, text }) => {
    const q = m.quoted ?? m;
    const type = q.mtype || "";
    const mime = (q.msg || q).mimetype || "";
    const cap = text?.trim() || "";
    
    try {
        if (!type && !cap) {
            return m.reply(
                `رد على صورة أو فيديو أو صوت، أو أرسل نصًا مع الأمر.\nمثال: ${usedPrefix + command} مرحبًا`
            );
        }
        
        await global.loading(m, sock);
        
        let content = {};
        const ctx = { isGroupStatus: true };
        
        if (type === "imageMessage" || /image/.test(mime)) {
            const buf = await q.download();
            if (!buf) throw new Error("تعذّر تنزيل الوسائط.");
            content = {
                image: buf,
                caption: cap || "",
                contextInfo: ctx
            };
        } else if (type === "videoMessage" || /video/.test(mime)) {
            const buf = await q.download();
            if (!buf) throw new Error("تعذّر تنزيل الوسائط.");
            content = {
                video: buf,
                caption: cap || "",
                contextInfo: ctx
            };
        } else if (type === "audioMessage" || type === "ptt" || /audio/
            .test(mime)) {
            const buf = await q.download();
            if (!buf) throw new Error("تعذّر تنزيل الوسائط.");
            content = {
                audio: buf,
                mimetype: "audio/mp4",
                contextInfo: ctx
            };
        } else if (cap) {
            content = {
                text: cap,
                contextInfo: ctx
            };
        } else {
            throw new Error("رد على وسائط أو أرسل نصًا مع الأمر.");
        }
        
        await sock.sendMessage(m.chat, content);
        
    } catch (e) {
        global.logger?.error(e, "Group status command failed");
        m.reply("تعذّر نشر الحالة.");
    } finally {
        await global.loading(m, sock, true);
    }
};

/**
 * Command metadata for help system
 * @property {Array<string>} help - Help text
 * @property {Array<string>} tags - Command categories
 * @property {RegExp} command - Command pattern matching
 * @property {boolean} owner - Owner-only command flag
 * @property {boolean} group - Group-only command flag
 */
handler.help = ["statusgc", "swgc", "gcstatus", "حالة_المجموعة"];
handler.tags = ["owner"];
handler.command = /^(statusgc|swgc|gcstatus|حالة_المجموعة)$/iu;
handler.owner = true;
handler.silentUnauthorized = true;
handler.group = true;

export default handler;