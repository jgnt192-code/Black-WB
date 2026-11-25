import { findGroupParticipant } from "#core/group-participants.js";

const USER_SERVERS = new Set([
    "s.whatsapp.net",
    "c.us",
    "lid",
    "hosted",
    "hosted.lid",
]);

const normalizeName = (value) =>
    String(value || "")
        .trim()
        .replace(/^@/u, "")
        .normalize("NFKC")
        .toLowerCase();

const getServer = (jid) =>
    typeof jid === "string" && jid.includes("@")
        ? jid.slice(jid.lastIndexOf("@") + 1).toLowerCase()
        : "";

const phoneDigits = (jid) => {
    if (typeof jid !== "string") return null;
    const server = getServer(jid);
    if (server && !["s.whatsapp.net", "c.us"].includes(server)) return null;
    const user = server ? jid.slice(0, jid.lastIndexOf("@")) : jid;
    if (!server && !/^[+\d\s().-]+$/u.test(user)) return null;
    const digits = user.split(":", 1)[0].replace(/\D/g, "");
    return digits.length >= 5 ? digits.replace(/^(213|218)0(?=\d{9}$)/u, "$1") : null;
};

export function parseTargetJid(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    const input = value.trim();

    if (input.includes("@")) {
        const [user, server] = input.split("@", 2);
        return user && USER_SERVERS.has(server?.toLowerCase()) ? input : null;
    }

    if (!/^[+\d\s().-]+$/u.test(input)) return null;
    const digits = input.replace(/\D/g, "");
    return digits.length >= 5 && digits.length <= 15
        ? `${digits}@s.whatsapp.net`
        : null;
}

export function findKnownContactJid(sock, name) {
    const query = normalizeName(name);
    if (!query || typeof sock?.getChats !== "function") {
        return { jid: null, ambiguous: false };
    }

    let chats;
    try {
        chats = sock.getChats();
    } catch {
        return { jid: null, ambiguous: false };
    }
    if (!Array.isArray(chats)) return { jid: null, ambiguous: false };

    const matches = chats
        .filter((chat) => {
            const jid = chat?.id || chat?.jid;
            if (typeof jid !== "string" || !jid.includes("@")) return false;
            const server = jid.slice(jid.lastIndexOf("@") + 1).toLowerCase();
            if (!USER_SERVERS.has(server)) return false;

            return [
                chat.name,
                chat.notify,
                chat.username,
                chat.verifiedName,
                chat.displayName,
            ].some((value) => typeof value === "string" && normalizeName(value) === query);
        })
        .map((chat) => chat.id || chat.jid);

    const unique = [...new Set(matches)];
    return {
        jid: unique.length === 1 ? unique[0] : null,
        ambiguous: unique.length > 1,
    };
}

export async function isSameWhatsAppUser(sock, left, right, participants = []) {
    if (typeof left !== "string" || typeof right !== "string" || !left || !right) {
        return false;
    }
    if (left === right) return true;

    const leftJid = parseTargetJid(left) || left;
    const rightJid = parseTargetJid(right) || right;
    const leftParticipant = await findGroupParticipant(sock, participants, leftJid);
    const rightParticipant = await findGroupParticipant(sock, participants, rightJid);
    if (
        leftParticipant?.id &&
        rightParticipant?.id &&
        leftParticipant.id === rightParticipant.id
    ) {
        return true;
    }

    const leftPhone = phoneDigits(leftJid);
    const rightPhone = phoneDigits(rightJid);
    if (leftPhone && rightPhone && leftPhone === rightPhone) return true;

    const mapping = sock?.signalRepository?.lidMapping;
    const leftServer = getServer(leftJid);
    const rightServer = getServer(rightJid);
    try {
        if (["lid", "hosted.lid"].includes(leftServer)) {
            const phone = await mapping?.getPNForLID?.(leftJid);
            if (phoneDigits(phone) && phoneDigits(phone) === rightPhone) return true;
        }
        if (["lid", "hosted.lid"].includes(rightServer)) {
            const phone = await mapping?.getPNForLID?.(rightJid);
            if (phoneDigits(phone) && phoneDigits(phone) === leftPhone) return true;
        }
        if (["s.whatsapp.net", "c.us"].includes(leftServer)) {
            const lid = await mapping?.getLIDForPN?.(leftJid);
            if (lid && lid === rightJid) return true;
        }
        if (["s.whatsapp.net", "c.us"].includes(rightServer)) {
            const lid = await mapping?.getLIDForPN?.(rightJid);
            if (lid && lid === leftJid) return true;
        }
    } catch {
        return false;
    }

    return false;
}

export async function resolveGroupTarget(
    sock,
    participants,
    message,
    input,
    { allowExternal = false } = {}
) {
    const mention = message?.mentionedJid?.[0];
    const quoted = message?.quoted?.sender;
    const parsed = parseTargetJid(input);
    const candidates = [mention, quoted, parsed].filter(
        (candidate) => typeof candidate === "string" && candidate.length > 0
    );

    for (const candidate of candidates) {
        const participant = await findGroupParticipant(sock, participants, candidate);
        if (participant?.id) return { jid: participant.id, ambiguous: false };
        if (allowExternal && [mention, quoted, parsed].includes(candidate)) {
            return { jid: candidate, ambiguous: false };
        }
    }

    if (input && !parsed) {
        const contact = findKnownContactJid(sock, input);
        if (contact.ambiguous) return contact;
        if (contact.jid) {
            const participant = await findGroupParticipant(sock, participants, contact.jid);
            if (participant?.id) return { jid: participant.id, ambiguous: false };
            if (allowExternal) return contact;
        }
    }

    return { jid: null, ambiguous: false };
}
