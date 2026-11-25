import { findGroupParticipant } from "#core/group-participants.js";

const LIST_PAGE_SIZE = 100;
const SELECTION_TTL_MS = 10 * 60 * 1000;
const BULK_DELAY_MS = 250;
const selections = new Map();

function getRecentGroups(sock) {
    let chats = [];
    try {
        chats = sock.getChats?.() || [];
    } catch {
        return [];
    }

    const unique = new Map();
    for (const chat of chats) {
        if (typeof chat?.id !== "string" || !chat.id.endsWith("@g.us")) continue;
        if (!unique.has(chat.id)) unique.set(chat.id, chat);
    }

    return [...unique.values()]
        .sort(
            (a, b) =>
                Number(b.conversationTimestamp || 0) -
                Number(a.conversationTimestamp || 0)
        )
        .map((chat) => ({
            id: chat.id,
            name: String(chat.subject || chat.name || "مجموعة").replace(/[\r\n]/gu, " "),
        }));
}

function getOwnerId(sock, m) {
    const sender = m.sender || m.key?.participant;
    if (!sender) return "";
    try {
        return sock.decodeJid?.(sender) || sender;
    } catch {
        return sender;
    }
}

async function resolveOwnerTarget(sock, ownerId) {
    if (!ownerId.includes("@")) return "";
    let target = ownerId;

    if (ownerId.endsWith("@lid")) {
        try {
            const phoneJid = await sock.signalRepository?.lidMapping?.getPNForLID?.(ownerId);
            if (phoneJid) target = sock.decodeJid?.(phoneJid) || phoneJid;
        } catch {
            // Keep the verified sender JID if no phone mapping is available.
        }
    }

    return /@(s\.whatsapp\.net|c\.us|lid|hosted|hosted\.lid)$/iu.test(target)
        ? target
        : "";
}

async function addOwnerToGroup(sock, group, target) {
    const metadata = await sock.groupMetadata(group.id);
    const participants = metadata?.participants || [];
    if (await findGroupParticipant(sock, participants, target)) return "existing";

    const botId = sock.decodeJid?.(sock.user?.id || "") || sock.user?.id || "";
    const botParticipant = await findGroupParticipant(sock, participants, botId);
    if (!["admin", "superadmin"].includes(String(botParticipant?.admin || "").toLowerCase())) {
        return "not-admin";
    }

    const result = await sock.groupParticipantsUpdate(group.id, [target], "add");
    const participantResult = Array.isArray(result)
        ? result.find((entry) => entry?.jid === target) || result[0]
        : null;
    const status = String(participantResult?.status ?? "");
    if (status === "200") return "added";
    if (status === "409") return "existing";
    return "failed";
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const handler = async (m, { sock, args = [], text = "", usedPrefix = "." }) => {
    if (m.isGroup) {
        return m.reply("أرسل هذا الأمر للبوت في محادثة خاصة.");
    }

    const prefix = usedPrefix || ".";
    const ownerId = getOwnerId(sock, m);
    if (!ownerId) return m.reply("تعذّر تحديد حسابك. أعد إرسال الأمر من واتساب.");

    if (!args.length && !String(text).trim()) {
        const groups = getRecentGroups(sock);
        if (!groups.length) {
            selections.delete(ownerId);
            return m.reply("لا توجد مجموعات محمّلة من واتساب للاختيار منها.");
        }

        const selection = {
            groups,
            messageIds: new Set(),
            expiresAt: Date.now() + SELECTION_TTL_MS,
        };
        selections.set(ownerId, selection);

        const pageCount = Math.ceil(groups.length / LIST_PAGE_SIZE);
        for (let page = 0; page < pageCount; page++) {
            const start = page * LIST_PAGE_SIZE;
            const pageGroups = groups.slice(start, start + LIST_PAGE_SIZE);
            const message = [
                `مجموعات البوت (${page + 1}/${pageCount}) — إجمالي ${groups.length}`,
                ...pageGroups.map((group, index) => `${start + index + 1}. ${group.name}`),
                "",
                `رد على هذه القائمة بـ ${prefix}اضف <رقم> أو ${prefix}اضف الكل.`,
                "تُضاف فقط المجموعات التي يكون البوت مشرفًا فيها.",
            ].join("\n");
            const sent = await m.reply(message);
            if (sent?.key?.id) selection.messageIds.add(sent.key.id);
        }

        if (!selection.messageIds.size) {
            selections.delete(ownerId);
            return m.reply("تعذّر حفظ قائمة المجموعات. أعد المحاولة.");
        }
        return;
    }

    const selection = selections.get(ownerId);
    if (!selection || Date.now() > selection.expiresAt) {
        selections.delete(ownerId);
        return m.reply(`أرسل ${prefix}اضفني أولًا لعرض قائمة مجموعات حديثة.`);
    }

    const quotedId = m.quoted?.id;
    const quotedChat = m.quoted?.chat || m.chat;
    if (
        !quotedId ||
        !selection.messageIds.has(quotedId) ||
        quotedChat !== m.chat
    ) {
        return m.reply(`رد على رسالة قائمة ${prefix}اضفني ثم استخدم ${prefix}اضف.`);
    }

    const selectionText = String(text || args.join(" ")).trim();
    const target = await resolveOwnerTarget(sock, ownerId);
    if (!target) return m.reply("تعذّر تحديد حساب واتساب لإضافته.");

    if (/^(?:الكل|للكل|كل|all)$/iu.test(selectionText)) {
        let added = 0;
        let failed = 0;

        for (let index = 0; index < selection.groups.length; index++) {
            try {
                const result = await addOwnerToGroup(sock, selection.groups[index], target);
                if (result === "added") added++;
                if (result === "failed") failed++;
            } catch {
                failed++;
            }

            if (index < selection.groups.length - 1) {
                await pause(BULK_DELAY_MS);
            }
        }

        selections.delete(ownerId);
        const summary = added
            ? `اكتملت العملية. تمت إضافتك إلى ${added} مجموعة.`
            : "اكتملت العملية.";
        return m.reply(
            failed
                ? `${summary}\nتعذّرت الإضافة إلى ${failed} مجموعة بسبب الصلاحيات أو قيود واتساب.`
                : summary
        );
    }

    const index = Number(selectionText);
    if (!Number.isInteger(index) || index < 1 || index > selection.groups.length) {
        return m.reply(`اختر رقمًا من القائمة. مثال: ${prefix}اضف 1`);
    }

    const group = selection.groups[index - 1];
    try {
        const result = await addOwnerToGroup(sock, group, target);
        if (result === "added") {
            selections.delete(ownerId);
            return m.reply(`تمت إضافة حسابك إلى مجموعة: ${group.name}.`);
        }
        if (result === "existing") {
            return m.reply("حسابك موجود بالفعل في هذه المجموعة.");
        }
        if (result === "not-admin") {
            return m.reply("يجب أن يكون البوت مشرفًا في المجموعة قبل طلب الإضافة.");
        }
        return m.reply("رفض واتساب الإضافة أو لا يملك البوت صلاحية الإشراف.");
    } catch (error) {
        global.logger?.error({ error: error?.message }, "Owner self-add command failed");
        return m.reply("تعذّرت إضافة حسابك. تحقق من المجموعة وصلاحيات البوت.");
    }
};

handler.help = ["اضفني", "اضف <رقم المجموعة>", "اضف الكل (ردًا على القائمة)"];
handler.tags = ["owner"];
handler.command = /^(?:اضفني|اضف)$/iu;
handler.owner = true;
handler.silentUnauthorized = true;
handler.cleanup = async () => selections.clear();

export default handler;
