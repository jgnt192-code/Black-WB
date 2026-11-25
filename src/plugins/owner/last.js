import { isSameWhatsAppUser } from "#core/resolve-target.js";

const PAGE_SIZE = 30;
const GROUP_METADATA_CONCURRENCY = 4;
const SUPPORTED_CHAT_TYPES = new Set([
    "g.us",
    "s.whatsapp.net",
    "c.us",
    "lid",
    "hosted",
    "hosted.lid",
    "newsletter",
]);

const toTimestampNumber = (value) => {
    try {
        const numeric =
            typeof value?.toNumber === "function"
                ? value.toNumber()
                : Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    } catch {
        return 0;
    }
};

const getChats = (sock) => {
    let source = [];
    try {
        source = sock.getChats?.() || [];
    } catch {
        return [];
    }
    if (!Array.isArray(source)) return [];

    const unique = new Map();
    for (const chat of source) {
        if (typeof chat?.id !== "string") continue;
        const id = sock.decodeJid?.(chat.id) || chat.id;
        const server = id.slice(id.lastIndexOf("@") + 1).toLowerCase();
        if (!id.includes("@") || !SUPPORTED_CHAT_TYPES.has(server)) continue;
        const previous = unique.get(id);
        unique.set(id, previous ? { ...previous, ...chat, id } : { ...chat, id });
    }

    return [...unique.values()].sort(
        (a, b) =>
            toTimestampNumber(b.conversationTimestamp) -
                toTimestampNumber(a.conversationTimestamp) ||
            a.id.localeCompare(b.id)
    );
};

const cleanLabel = (value) =>
    String(value || "")
        .replace(/[\r\n\t]+/gu, " ")
        .replace(/\s{2,}/gu, " ")
        .trim()
        .slice(0, 120);

const isGroupChat = (chat) => chat.id.endsWith("@g.us");

const loadGroupMetadata = async (sock, chats) => {
    if (typeof sock.groupMetadata !== "function") return;

    const groups = chats.filter(
        (chat) =>
            isGroupChat(chat) && !Array.isArray(chat.metadata?.participants)
    );
    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < groups.length) {
            const chat = groups[nextIndex++];
            try {
                const metadata = await sock.groupMetadata(chat.id);
                if (!metadata) continue;
                chat.metadata = metadata;
                if (metadata.subject) chat.subject = metadata.subject;
            } catch {
                // Keep the chat visible and mark its member count as unavailable.
            }
        }
    };

    await Promise.all(
        Array.from(
            { length: Math.min(GROUP_METADATA_CONCURRENCY, groups.length) },
            worker
        )
    );
};

const getChatLabel = (chat, index) => {
    const id = chat.id;
    const server = id.slice(id.lastIndexOf("@") + 1).toLowerCase();
    const name = cleanLabel(
        chat.subject || chat.name || chat.notify || chat.verifiedName
    );

    if (server === "g.us") {
        const members = Array.isArray(chat.metadata?.participants)
            ? chat.metadata.participants.length
            : null;
        const memberCount =
            members === null ? "غير متاح" : String(members);
        return `الدردشة رقم ${index}: ${name || "مجموعة"} — مجموعة — الأعضاء: ${memberCount}`;
    }
    if (server === "newsletter") {
        return `الدردشة رقم ${index}: ${name || "قناة"} — قناة`;
    }
    return `الدردشة رقم ${index}: ${name || "اسم الحساب غير متاح"}`;
};

const getAllowedUsers = () =>
    String(Bun.env.LAST_COMMAND_ALLOWED_USERS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
            if (value.includes("@")) return value;
            const digits = value.replace(/\D/g, "");
            return digits ? `${digits}@s.whatsapp.net` : "";
        })
        .filter(Boolean);

const canUseLast = async (sock, m, isOwner) => {
    if (isOwner) return true;
    const sender = m.sender || m.key?.participant;
    if (!sender) return false;

    for (const allowedUser of getAllowedUsers()) {
        if (await isSameWhatsAppUser(sock, sender, allowedUser)) return true;
    }
    return false;
};

const handler = async (m, { sock, isOwner, usedPrefix = "." }) => {
    if (m.isGroup || !(await canUseLast(sock, m, isOwner))) return;

    const raw = String(m.text || "")
        .trim()
        .replace(/^[/.!]\s*/u, "");
    const match = raw.match(/^(?:last|لاست)(?:\s+(\d+))?$/iu);
    if (!match) return;

    const page = match[1] ? Number(match[1]) : 1;
    if (!Number.isSafeInteger(page) || page < 1) {
        return m.reply(`استخدم رقم صفحة صحيحًا. مثال: ${usedPrefix}last 2`);
    }

    const chats = getChats(sock);
    if (!chats.length) {
        return m.reply(
            "لم تُحمّل محادثات واتساب بعد. انتظر مزامنة الحساب ثم أعد المحاولة."
        );
    }

    const pageCount = Math.ceil(chats.length / PAGE_SIZE);
    if (page > pageCount) {
        return m.reply(`رقم الصفحة غير موجود. الصفحات المتاحة: 1 إلى ${pageCount}.`);
    }

    const start = (page - 1) * PAGE_SIZE;
    const pageChats = chats.slice(start, start + PAGE_SIZE);
    await loadGroupMetadata(sock, pageChats);

    const groupCount = chats.filter(isGroupChat).length;
    const privateChatCount = chats.filter(
        (chat) => !isGroupChat(chat) && !chat.id.endsWith("@newsletter")
    ).length;
    const lines = pageChats
        .map((chat, index) => getChatLabel(chat, start + index + 1));
    const output = [
        `دردشات حساب البوت: ${chats.length} — المجموعات: ${groupCount} — المحادثات الخاصة: ${privateChatCount} — الصفحة ${page}/${pageCount}`,
        ...lines,
    ];
    if (page < pageCount) {
        output.push("", `للمتابعة: ${usedPrefix}last ${page + 1}`);
    }

    const sync = sock.getChatSyncStatus?.();
    if (sync?.started && !sync.complete) {
        output.push("", "تنبيه: مزامنة سجل المحادثات ما زالت جارية؛ أعد الأمر بعد اكتمالها.");
    }

    return m.reply(output.join("\n"));
};

handler.help = ["last", "لاست", "last <رقم الصفحة>"];
handler.tags = ["owner"];
handler.owner = false;
handler.silentUnauthorized = true;
handler.customPrefix = /^[/.!]?\s*(?:last|لاست)(?=\s|$)/iu;
handler.command = /(?:)/i;

export default handler;
