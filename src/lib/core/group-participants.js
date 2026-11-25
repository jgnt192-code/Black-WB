const normalizeJid = (sock, jid) => {
    if (typeof jid !== "string" || !jid) return "";

    try {
        return sock?.decodeJid?.(jid) || jid;
    } catch {
        return jid;
    }
};

export async function findGroupParticipant(sock, participants, candidate) {
    if (typeof candidate !== "string" || !candidate.trim()) return null;

    const list = Array.isArray(participants) ? participants : [];
    const jid = candidate.trim();
    const normalized = normalizeJid(sock, jid);
    const findMatch = (value) =>
        list.find(
            (participant) =>
                typeof participant?.id === "string" &&
                (participant.id === value ||
                    normalizeJid(sock, participant.id) === normalizeJid(sock, value))
        ) || null;

    const directMatch = findMatch(jid) || findMatch(normalized);
    if (directMatch) return directMatch;

    const server = jid.slice(jid.lastIndexOf("@") + 1).toLowerCase();
    const lidMapping = sock?.signalRepository?.lidMapping;
    let mappedJid = null;

    try {
        if (server === "s.whatsapp.net" || server === "hosted") {
            mappedJid = await lidMapping?.getLIDForPN?.(jid);
        } else if (server === "lid" || server === "hosted.lid") {
            mappedJid = await lidMapping?.getPNForLID?.(jid);
        }
    } catch {
        return null;
    }

    return mappedJid ? findMatch(mappedJid) : null;
}
