const STOP_LOCK_WORDS = /^(?:قف|وقف|إيقاف|stop|off)$/iu;

const handler = async (m, { sock, isOwner }) => {
    if (!isOwner) return;

    const title = (m.text || "")
        .trim()
        .replace(/^[/.!]?\s*(?:اسم|settitle)(?=\s|$)/iu, "")
        .trim();

    if (STOP_LOCK_WORDS.test(title)) {
        return sock.sendMessage(
            m.chat,
            {
                text: "لا يوجد قفل تلقائي لاسم المجموعة. الأمر «اسم <العنوان>» يغيّر الاسم مرة واحدة فقط.",
            },
            { quoted: m }
        );
    }

    if (!m.isGroup) {
        return sock.sendMessage(
            m.chat,
            { text: "استخدم هذا الأمر داخل المجموعة التي تريد تغيير اسمها." },
            { quoted: m }
        );
    }

    if (!title) {
        return sock.sendMessage(
            m.chat,
            { text: "اكتب الاسم بعد الأمر، مثل: اسم ززتت" },
            { quoted: m }
        );
    }

    if (Array.from(title).length > 100) {
        return sock.sendMessage(
            m.chat,
            { text: "اسم المجموعة يجب ألا يتجاوز 100 حرف." },
            { quoted: m }
        );
    }

    try {
        await sock.groupUpdateSubject(m.chat, title);
        return sock.sendMessage(
            m.chat,
            { text: `تم تغيير اسم المجموعة إلى: ${title}` },
            { quoted: m }
        );
    } catch {
        return sock.sendMessage(
            m.chat,
            { text: "تعذر تغيير الاسم. تأكد أن البوت مشرف في المجموعة." },
            { quoted: m }
        );
    }
};

handler.help = ["اسم <العنوان>", "settitle <العنوان>"];
handler.tags = ["owner"];
handler.customPrefix = /^[/.!]?\s*(?:اسم|settitle)(?=\s|$)/iu;
handler.owner = true;
handler.silentUnauthorized = true;
handler.command = /(?:)/i;

export default handler;
