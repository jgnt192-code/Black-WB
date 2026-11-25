/**
 * @file Read view-once media command handler
 * @module plugins/tools/readviewonce
 * @license Apache-2.0
 * @author Naruya Izumi
 */

/**
 * Extracts and displays view-once (disappearing) media
 * @async
 * @function handler
 * @param {Object} m - Message object
 * @param {Object} sock - Connection object
 * @returns {Promise<void>}
 *
 * @description
 * Command to extract and display view-once (disappearing) media from WhatsApp messages.
 * Supports images, videos, and audio sent with view-once feature enabled.
 *
 * @features
 * - Extracts view-once images, videos, and audio
 * - Preserves media captions and mentions
 * - Handles various media types and mimetypes
 * - Provides error handling for unsupported media
 */

let handler = async (m, { sock }) => {
    const q = m.quoted;
    try {
        const mq = q?.mediaMessage;

        if (!mq) {
            throw new Error("لم ترد على رسالة تحتوي على وسائط.");
        }

        const v = mq.videoMessage || mq.imageMessage || mq.audioMessage;

        if (!v) {
            throw new Error("نوع الوسائط غير مدعوم.");
        }

        if (!v.viewOnce) {
            throw new Error("الرسالة ليست من نوع العرض لمرة واحدة.");
        }

        const buf = await q.download?.();
        if (!buf) {
            throw new Error("تعذّر تنزيل الوسائط.");
        }

        const mime = v.mimetype || "";
        let t;
        if (mime.startsWith("image/") || mq.imageMessage) {
            t = "image";
        } else if (mime.startsWith("video/") || mq.videoMessage) {
            t = "video";
        } else if (mime.startsWith("audio/") || mq.audioMessage) {
            t = "audio";
        } else {
            throw new Error("نوع الوسائط غير مدعوم.");
        }

        const cap = v.caption || q.text || "";
        const ctx = {};

        if (v.contextInfo?.mentionedJid?.length > 0) {
            ctx.mentionedJid = v.contextInfo.mentionedJid;
        }

        await sock.sendMessage(
            m.chat,
            {
                [t]: buf,
                mimetype: mime,
                caption: cap,
                contextInfo: ctx,
            },
            { quoted: m }
        );
    } catch (e) {
        m.reply(e.message);
    }
};

/**
 * Command metadata for help system
 * @property {Array<string>} help - Help text
 * @property {Array<string>} tags - Command categories
 * @property {RegExp} command - Command pattern matching
 */
handler.help = ["readviewonce", "rvo", "قراءةمرة"];
handler.tags = ["tools"];
handler.command = /^(read(view(once)?)?|rvo|قراءةمرة)$/iu;
handler.hiddenFromMenu = true;

export default handler;
