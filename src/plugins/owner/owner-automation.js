/**
 * @file Configure opt-in presence, reaction, and welcome automations
 * @license Apache-2.0
 */

import { getBotSettings, updateBotSettings } from "#lib/bot-settings.js";

const TIMERS = new Map();
let boundSocket;
let participantListener;

const ON = new Set(["on", "yes", "تشغيل", "تفعيل", "نعم"]);
const OFF = new Set(["off", "no", "إيقاف", "ايقاف", "تعطيل", "لا"]);
const OPTIONS = {
    autoreact: "autoreact",
    setlike: "statuslike",
    autotype: "autotype",
    setautotype: "autotype",
    autorecord: "autorecord",
    setautorecord: "autorecord",
    statuslike: "statuslike",
    setonline: "online",
};

async function setGroupWelcome(group, enabled) {
    return updateBotSettings((settings) => ({
        ...settings,
        welcomeGroups: {
            ...settings.welcomeGroups,
            [group]: enabled,
        },
    }));
}

async function attachParticipantListener(sock) {
    if (!sock?.ev || boundSocket === sock) return;
    if (boundSocket && participantListener) {
        boundSocket.ev.off("group-participants.update", participantListener);
    }

    participantListener = async (update) => {
        if (update?.action !== "add" || !update.id?.endsWith("@g.us")) return;
        try {
            const settings = await getBotSettings();
            if (!settings.welcomeGroups?.[update.id]) return;

            const mentions = (update.participants || [])
                .map((participant) =>
                    typeof participant === "string" ? participant : participant?.id
                )
                .filter(Boolean)
                .slice(0, 20);
            if (!mentions.length) return;

            const names = mentions.map((jid) => `@${jid.split("@")[0]}`).join(" ");
            await sock.sendMessage(update.id, {
                text: `أهلًا ${names}، نورتوا المجموعة.`,
                mentions,
            });
        } catch (error) {
            global.logger?.warn({ error: error.message }, "Welcome message failed");
        }
    };

    sock.ev.on("group-participants.update", participantListener);
    boundSocket = sock;
}

const handler = async (m, { sock, args, command, text, usedPrefix }) => {
    const setting = OPTIONS[command];
    const value = (args[0] || "").toLowerCase();

    if (command === "welcome" || command === "setwelcome") {
        if (!m.isGroup) return m.reply("استخدم هذا الأمر داخل المجموعة المطلوبة.");
        if (!ON.has(value) && !OFF.has(value)) {
            return m.reply(`الاستخدام: ${usedPrefix + command} on أو off`);
        }
        await setGroupWelcome(m.chat, ON.has(value));
        return m.reply(`رسالة الترحيب ${ON.has(value) ? "مفعّلة" : "متوقفة"} لهذه المجموعة.`);
    }

    if (command === "setreaction") {
        const emoji = text.trim();
        if (!emoji || Array.from(emoji).length > 8 || /\s/u.test(emoji)) {
            return m.reply(`أرسل رمزًا تعبيريًا واحدًا.\nمثال: ${usedPrefix + command} 💚`);
        }
        await updateBotSettings((settings) => ({ ...settings, reaction: emoji }));
        return m.reply(`تم ضبط التفاعل التلقائي على ${emoji}.`);
    }

    if (!setting) return m.reply("هذا الإعداد غير معروف.");
    if (!ON.has(value) && !OFF.has(value)) {
        return m.reply(`الاستخدام: ${usedPrefix + command} on أو off`);
    }

    await updateBotSettings((settings) => ({
        ...settings,
        [setting]: ON.has(value),
    }));
    return m.reply(`${command}: ${ON.has(value) ? "مفعّل" : "متوقف"}.`);
};

handler.all = async function (m) {
    const sock = this;
    await attachParticipantListener(sock);
    const settings = await getBotSettings();

    if (m.fromMe) return;
    const isStatus = m.key?.remoteJid === "status@broadcast";
    if (isStatus) {
        const participant = m.key?.participant || m.sender;
        if (settings.statuslike && participant) {
            await sock.sendMessage(participant, {
                react: { text: settings.reaction || "💚", key: m.key },
            }).catch(() => {});
        }
        return;
    }

    if (settings.online) {
        await sock.sendPresenceUpdate("available").catch(() => {});
    }

    if (settings.autotype || settings.autorecord) {
        const state = settings.autorecord ? "recording" : "composing";
        await sock.sendPresenceUpdate(state, m.chat).catch(() => {});
        clearTimeout(TIMERS.get(m.chat));
        const timer = setTimeout(() => {
            sock.sendPresenceUpdate("paused", m.chat).catch(() => {});
            TIMERS.delete(m.chat);
        }, 4000);
        timer.unref?.();
        TIMERS.set(m.chat, timer);
    }

    const isCommand = /^[/.!]/u.test(m.text?.trim() || "");
    if (settings.autoreact && !isCommand) {
        await sock.sendMessage(m.chat, {
            react: { text: settings.reaction || "💚", key: m.key },
        }).catch(() => {});
    }
};

handler.init = async () => attachParticipantListener(global.sock);
handler.cleanup = async () => {
    if (boundSocket && participantListener) {
        boundSocket.ev.off("group-participants.update", participantListener);
    }
    boundSocket = undefined;
    participantListener = undefined;
    for (const timer of TIMERS.values()) clearTimeout(timer);
    TIMERS.clear();
};

handler.help = [
    "autoreact on/off",
    "setreaction <emoji>",
    "autotype on/off",
    "setautotype on/off",
    "autorecord on/off",
    "setautorecord on/off",
    "statuslike on/off",
    "setlike on/off",
    "setonline on/off",
    "welcome on/off",
    "setwelcome on/off",
];
handler.tags = ["owner"];
handler.command = /^(autoreact|setlike|setreaction|autotype|setautotype|autorecord|setautorecord|statuslike|setonline|welcome|setwelcome)$/iu;
handler.owner = true;
handler.silentUnauthorized = true;

export default handler;
