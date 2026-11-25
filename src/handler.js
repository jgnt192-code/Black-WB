/**
 * @file WhatsApp message handler and command processor
 * @module core/handler
 * @description Main command handler for Black-Mahora bot - processes incoming messages,
 * validates permissions, executes plugins, and manages command routing.
 * @license Apache-2.0
 * @author Naruya Izumi
 */

import { smsg } from "#core/smsg.js";
import { findGroupParticipant } from "#core/group-participants.js";
import { isRepeatLoopActive } from "#core/repeat-loop.js";
import { getBotSettings } from "#lib/bot-settings.js";
import { join, dirname } from "node:path";

const CMD_PREFIX_RE = /^[/!.]/;

const safe = async (fn, fallback = undefined) => {
    try {
        return await fn();
    } catch {
        return fallback;
    }
};

const parsePrefix = (connPrefix, pluginPrefix) => {
    if (pluginPrefix) return pluginPrefix;
    if (connPrefix) return connPrefix;
    return CMD_PREFIX_RE;
};

const matchPrefix = (prefix, text) => {
    if (prefix instanceof RegExp) {
        return [[prefix.exec(text), prefix]];
    }

    if (Array.isArray(prefix)) {
        return prefix.map((p) => {
            const re =
                p instanceof RegExp ? p : new RegExp(p.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&"));
            return [re.exec(text), re];
        });
    }

    if (typeof prefix === "string") {
        const escaped = prefix.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
        const regex = new RegExp(`^${escaped}`, "i");
        return [[regex.exec(text), regex]];
    }

    return [[[], new RegExp()]];
};

const isCmdMatch = (cmd, rule) => {
    if (rule instanceof RegExp) return rule.test(cmd);
    if (Array.isArray(rule))
        return rule.some((r) => (r instanceof RegExp ? r.test(cmd) : r === cmd));
    if (typeof rule === "string") return rule === cmd;
    return false;
};

const jidUser = (jid) =>
    typeof jid === "string" ? jid.split("@", 1)[0].split(":", 1)[0] : "";

const phoneDigits = (jid) => {
    if (typeof jid !== "string") return null;

    const [user = "", server = ""] = jid.trim().split("@", 2);
    const normalizedServer = server.toLowerCase();
    const isPhoneJid =
        normalizedServer === "s.whatsapp.net" || normalizedServer === "c.us";
    const hasPhoneFormatting = /[+\s().-]/.test(user);

    if (server && !isPhoneJid) return null;
    if (!server && !hasPhoneFormatting) return null;

    const digits = user.split(":", 1)[0].replace(/\D/g, "");
    return digits.length >= 5 ? digits : null;
};

const normalizeOwnerPhone = (jid) => {
    const digits = phoneDigits(jid);
    return digits?.replace(/^(213|218)0(?=\d{9}$)/, "$1") || null;
};

const isConfiguredOwner = (m, owners) => {
    const senderJids = [
        m.sender,
        m.key?.participant,
        m.key?.participantAlt,
        ...(!m.isGroup ? [m.key?.remoteJidAlt] : []),
    ].filter((jid) => typeof jid === "string" && jid.length > 0);

    const ownerIds = owners.map((owner) => String(owner).trim()).filter(Boolean);
    if (ownerIds.some((owner) => senderJids.some((jid) => jidUser(jid) === jidUser(owner)))) {
        return true;
    }

    const ownerPhones = ownerIds.map(normalizeOwnerPhone).filter(Boolean);
    if (ownerPhones.length === 0) return false;

    const senderPhones = senderJids.map(normalizeOwnerPhone).filter(Boolean);
    return ownerPhones.some((phone) => senderPhones.includes(phone));
};

const getGroupMetadata = async (sock, chat) => {
    let chatData = {};

    try {
        chatData = (await sock.getChat?.(chat)) || {};
    } catch {
        chatData = {};
    }

    const cachedMetadata = chatData?.metadata;
    if (
        Array.isArray(cachedMetadata?.participants) &&
        cachedMetadata.participants.length > 0
    ) {
        return cachedMetadata;
    }

    try {
        const metadata = await sock.groupMetadata(chat);
        if (Array.isArray(metadata?.participants)) {
            if (typeof sock.setChat === "function") {
                await sock.setChat(chat, {
                    ...chatData,
                    id: chat,
                    subject: metadata.subject || chatData.subject,
                    metadata,
                });
            }
            return metadata;
        }
    } catch (error) {
        global.logger?.debug(
            { error: error?.message },
            "Group metadata lookup failed"
        );
    }

    return cachedMetadata || chatData || {};
};

async function printMessage(
    m,
    sock = {
        user: {},
        decodeJid: (id) => id,
        getName: async () => "Unknown",
        logger: console,
    }
) {
    try {
        if (!m || !m.sender || !m.chat || !m.mtype) return;

        const sender = sock.decodeJid(m.sender);
        const chat = sock.decodeJid(m.chat);
        const user = (await sock.getName(sender)) || "Unknown";

        const getIdFormat = (id) => {
            if (id?.endsWith("@lid")) return "LID";
            if (id?.endsWith("@s.whatsapp.net")) return "PN";
            if (id?.startsWith("@")) return "Username";
            return "Unknown";
        };

        const getChatContext = (id) => {
            if (id?.endsWith("@g.us")) return "Group";
            if (id?.endsWith("@broadcast")) return "Broadcast";
            if (id?.endsWith("@newsletter")) return "Channel";
            if (id?.endsWith("@lid") || id?.endsWith("@s.whatsapp.net")) return "Private";
            return "Unknown";
        };

        const rawText = m.text?.trim() || "";
        const prefixMatch = rawText.match(/^([/!.])\s*(\S+)/);
        const prefix = m.prefix || (prefixMatch ? prefixMatch[1] : null);
        const command = m.command || (prefixMatch ? prefixMatch[2] : null);
        if (!prefix || !command) return;

        const cmd = `${prefix}${command}`;
        const idFormat = getIdFormat(sender);
        const chatContext = getChatContext(chat);

        global.logger.info(
            {
                user: user,
                sender: sender,
                idFormat: idFormat,
                chatContext: chatContext,
            },
            `${cmd} executed`
        );
    } catch {
        // Silent fail
    }
}

export async function handler(chatUpdate) {
    try {
        if (!chatUpdate) return;

        this.pushMessage(chatUpdate.messages);

        const messages = chatUpdate.messages;
        if (!messages || messages.length === 0) return;

        const m = smsg(this, messages[messages.length - 1]);
        if (!m || m.isBaileys) return;

        const botSettings = await safe(() => getBotSettings(), { botOwners: [] });
        const primaryOwner =
            global.config.primaryOwner ||
            global.config.owner?.[0] ||
            this.user?.lid ||
            this.user?.id ||
            "";
        const ownerIds = [
            ...(global.config.owner || []),
            ...(botSettings.botOwners || []),
            primaryOwner,
        ].filter(Boolean);
        const isPrimaryOwner = isConfiguredOwner(m, [primaryOwner]);
        const isOwner = m.fromMe || isConfiguredOwner(m, ownerIds);

        if (isRepeatLoopActive()) {
            const stopLoopCommand =
                /^[/.!]?\s*(?:لول|lol|loop)\s+(?:قف|وقف|إيقاف|stop|off)\s*$/iu.test(
                    m.text?.trim() || ""
                );
            if (!isOwner || !stopLoopCommand) return;
        }

        if (!isOwner && !m.isGroup && /^[/.!]lid$/i.test(m.text?.trim() || "")) {
            await this.sendMessage(m.chat, {
                text: `معرّف واتساب (LID) لهذا الحساب:\n${senderLid}\nأرسل هذا المعرّف لمسؤول البوت لإضافته.`,
            }, { quoted: m });
            return;
        }

        if (!m.fromMe && global.config.self && !isOwner) {
            return;
        }

        let groupMetadata = {};
        let participants = [];
        let user = {};
        let bot = {};
        let isRAdmin = false;
        let isAdmin = false;
        let isBotAdmin = false;

        if (m.isGroup) {
            groupMetadata = await getGroupMetadata(this, m.chat);
            participants = groupMetadata?.participants || [];
            user =
                (await findGroupParticipant(this, participants, m.sender)) || {};
            bot =
                (await findGroupParticipant(
                    this,
                    participants,
                    this.user?.lid || this.user?.id
                )) || {};
            isRAdmin = user?.admin === "superadmin";
            isAdmin = isRAdmin || user?.admin === "admin";
            isBotAdmin = bot?.admin === "admin" || bot?.admin === "superadmin";
        }

        const __dirname = dirname(Bun.fileURLToPath(import.meta.url));
        const pluginDir = join(__dirname, "./plugins");

        for (const name in global.plugins) {
            const plugin = global.plugins[name];
            if (!plugin || plugin.disabled) continue;
            if (m.fromMe && !plugin.owner) continue;

            const __filename = join(pluginDir, name);

            if (typeof plugin.all === "function") {
                await safe(() =>
                    plugin.all.call(this, m, {
                        chatUpdate,
                        __dirname: pluginDir,
                        __filename,
                    })
                );
            }

            if (typeof plugin !== "function") continue;

            const prefix = parsePrefix(this.prefix, plugin.customPrefix);
            const body = typeof m.text === "string" ? m.text : "";
            const match = matchPrefix(prefix, body).find((p) => p[1]);

            let usedPrefix;
            if ((usedPrefix = (match?.[0] || "")[0])) {
                const noPrefix = body.replace(usedPrefix, "");
                const parts = noPrefix.trim().split(/\s+/);
                const [rawCmd, ...argsArr] = parts;
                const command = (rawCmd || "").toLowerCase();
                const text = parts.slice(1).join(" ");

                if (!isCmdMatch(command, plugin.command)) continue;

                m.plugin = name;

                const fail = plugin.fail || global.dfail;

                if (plugin.owner && !isOwner) {
                    if (!plugin.silentUnauthorized) fail("owner", m, this);
                    continue;
                }

                if (plugin.primaryOwner && !isPrimaryOwner) {
                    await safe(() => m.reply("هذا الأمر للمالك الأول فقط."));
                    continue;
                }

                if (plugin.group && !m.isGroup) {
                    fail("group", m, this);
                    continue;
                }

                if (plugin.botAdmin && !isBotAdmin) {
                    fail("botAdmin", m, this);
                    continue;
                }

                if (plugin.admin && !isAdmin && !isOwner) {
                    fail("admin", m, this);
                    continue;
                }

                const extra = {
                    match,
                    usedPrefix,
                    noPrefix,
                    args: argsArr,
                    command,
                    text,
                    sock: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isOwner,
                    isPrimaryOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    chatUpdate,
                    __dirname: pluginDir,
                    __filename,
                };

                try {
                    await plugin.call(this, m, extra);
                } catch {
                    await safe(() => m.reply("تعذّر تنفيذ الأمر. حاول مرة أخرى لاحقًا."));
                }

                break;
            }
        }

        await safe(() => printMessage(m, this));
    } catch {
        // Silent fail
    }
}