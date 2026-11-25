/**
 * List bot owners or remove a dynamically added owner.
 * The primary owner is always visible and cannot be removed here.
 * @license Apache-2.0
 */

import { getBotSettings, updateBotSettings } from "#lib/bot-settings.js";
import {
    isSameWhatsAppUser,
    resolveGroupTarget,
} from "#core/resolve-target.js";

const SELECTION_TTL_MS = 5 * 60 * 1000;
const listSelections = new Map();

const cleanIdentifier = (value) =>
    String(value || "")
        .replace(/[\r\n\t]+/gu, " ")
        .replace(/\s{2,}/gu, " ")
        .trim()
        .slice(0, 120);

const getPrimaryOwner = (sock) =>
    global.config?.primaryOwner ||
    global.config?.owner?.[0] ||
    sock.user?.lid ||
    sock.user?.id ||
    "";

const getSender = (m) => m.sender || m.key?.participant || "";

const clearExpiredSelections = () => {
    const now = Date.now();
    for (const [messageId, selection] of listSelections) {
        if (selection.expiresAt <= now) listSelections.delete(messageId);
    }
};

const getOwnerRows = async (
    sock,
    participants,
    primaryOwner,
    configuredOwners,
    savedOwners
) => {
    const rows = [];
    const candidates = [
        ...(primaryOwner ? [{ jid: primaryOwner, type: "primary" }] : []),
        ...configuredOwners.map((jid) => ({ jid, type: "configured" })),
        ...savedOwners.map((jid) => ({ jid, type: "saved" })),
    ];
    const priority = { saved: 1, configured: 2, primary: 3 };

    for (const candidate of candidates) {
        if (typeof candidate.jid !== "string" || !candidate.jid.trim()) continue;

        let existing;
        for (const row of rows) {
            if (
                await isSameWhatsAppUser(
                    sock,
                    candidate.jid,
                    row.jid,
                    participants
                )
            ) {
                existing = row;
                break;
            }
        }

        if (existing) {
            if (priority[candidate.type] > priority[existing.type]) {
                existing.type = candidate.type;
            }
        } else {
            rows.push({ ...candidate });
        }
    }

    return rows;
};

const formatOwnerRow = (row, index) => {
    const identifier = cleanIdentifier(row.jid);
    if (row.type === "primary") {
        return `${index + 1}. ${identifier} — أساسي (محمي)`;
    }
    if (row.type === "configured") {
        return `${index + 1}. ${identifier} — إعدادات (محمي)`;
    }
    return `${index + 1}. ${identifier} — قابل للحذف`;
};

const isCurrentOwner = async (sock, sender) => {
    if (!sender) return false;
    const settings = await getBotSettings();
    const owners = [
        ...(Array.isArray(global.config?.owner) ? global.config.owner : []),
        ...(settings.botOwners || []),
        getPrimaryOwner(sock),
    ].filter(Boolean);

    for (const owner of owners) {
        if (await isSameWhatsAppUser(sock, sender, owner)) return true;
    }
    return false;
};

const removeListedOwner = async (m, sock, row) => {
    const settings = await getBotSettings();
    const primaryOwner = getPrimaryOwner(sock);
    if (
        row.type === "primary" ||
        (primaryOwner &&
            (await isSameWhatsAppUser(sock, row.jid, primaryOwner)))
    ) {
        return m.reply("محمي.");
    }

    const configuredOwners = Array.isArray(global.config?.owner)
        ? global.config.owner
        : [];
    for (const owner of configuredOwners) {
        if (await isSameWhatsAppUser(sock, row.jid, owner)) {
            return m.reply("محمي من الحذف.");
        }
    }

    const matchingSavedOwners = [];
    for (const owner of settings.botOwners || []) {
        if (await isSameWhatsAppUser(sock, row.jid, owner)) {
            matchingSavedOwners.push(owner);
        }
    }
    if (!matchingSavedOwners.length) return m.reply("غير موجود.");

    await updateBotSettings((current) => ({
        ...current,
        botOwners: (current.botOwners || []).filter(
            (owner) => !matchingSavedOwners.includes(owner)
        ),
    }));
    return m.reply("تم الحذف.");
};

const removeBySelection = async (m, sock, selection, index) => {
    if (!selection || selection.chat !== m.chat) return false;
    const sender = getSender(m);
    if (
        !(await isSameWhatsAppUser(sock, sender, selection.owner)) ||
        !(await isCurrentOwner(sock, sender))
    ) {
        return false;
    }

    if (!Number.isSafeInteger(index) || index < 1 || index > selection.rows.length) {
        await m.reply("رقم غير صحيح.");
        return true;
    }
    await removeListedOwner(m, sock, selection.rows[index - 1]);
    return true;
};

const handler = async (
    m,
    { sock, text = "", participants = [], usedPrefix = "." }
) => {
    if (m.isGroup) {
        return m.reply("خاص فقط.");
    }

    const settings = await getBotSettings();
    const primaryOwner = getPrimaryOwner(sock);
    const configuredOwners = global.config?.owner || [];
    const savedOwners = settings.botOwners || [];
    const requestedTarget = String(text).trim();
    const hasMentionOrReply = Boolean(
        m.mentionedJid?.[0] || m.quoted?.sender
    );
    const selection = m.quoted?.id
        ? listSelections.get(m.quoted.id)
        : null;
    if (/^\d+$/u.test(requestedTarget) && selection) {
        const handled = await removeBySelection(
            m,
            sock,
            selection,
            Number(requestedTarget)
        );
        if (handled) return;
    }

    const showList =
        /^(?:list|عرض|قائمة)$/iu.test(requestedTarget) ||
        (!requestedTarget && !hasMentionOrReply);

    if (showList) {
        clearExpiredSelections();
        const rows = await getOwnerRows(
            sock,
            participants,
            primaryOwner,
            configuredOwners,
            savedOwners
        );
        if (!rows.length) return m.reply("لا يوجد مالكون.");

        const sent = await m.reply(
            [
                "مالكو البوت — رد برقم الحذف:",
                ...rows.map((row, index) => formatOwnerRow(row, index)),
            ].join("\n")
        );
        const sender = getSender(m);
        if (sent?.key?.id && sender) {
            listSelections.set(sent.key.id, {
                owner: sender,
                chat: m.chat,
                rows,
                expiresAt: Date.now() + SELECTION_TTL_MS,
            });
        }
        return sent;
    }

    const resolved = await resolveGroupTarget(
        sock,
        participants,
        m,
        requestedTarget,
        { allowExternal: true }
    );
    if (resolved.ambiguous) {
        return m.reply("الاسم غير محدد.");
    }
    if (!resolved.jid) {
        return m.reply("غير موجود.");
    }

    if (
        primaryOwner &&
        (await isSameWhatsAppUser(
            sock,
            resolved.jid,
            primaryOwner,
            participants
        ))
    ) {
        return m.reply("محمي.");
    }

    for (const owner of configuredOwners) {
        if (
            await isSameWhatsAppUser(sock, resolved.jid, owner, participants)
        ) {
            return m.reply("محمي من الحذف.");
        }
    }

    const matchingSavedOwners = [];
    for (const owner of savedOwners) {
        if (
            await isSameWhatsAppUser(sock, resolved.jid, owner, participants)
        ) {
            matchingSavedOwners.push(owner);
        }
    }
    if (!matchingSavedOwners.length) {
        return m.reply("غير موجود.");
    }

    await updateBotSettings((current) => ({
        ...current,
        botOwners: (current.botOwners || []).filter(
            (owner) => !matchingSavedOwners.includes(owner)
        ),
    }));
    return m.reply("تم الحذف.");
};

handler.all = async function (m) {
    clearExpiredSelections();
    if (m.fromMe || m.isGroup || !m.quoted?.id) return;
    const match = String(m.text || "").trim().match(/^(\d+)$/u);
    if (!match) return;

    const selection = listSelections.get(m.quoted.id);
    if (!selection) return;
    await removeBySelection(m, this, selection, Number(match[1]));
};

handler.help = ["dladmin", "dladmin <اسم أو رقم>"];
handler.tags = ["owner"];
handler.command = /^dladmin$/iu;
handler.owner = true;
handler.silentUnauthorized = true;

export default handler;
