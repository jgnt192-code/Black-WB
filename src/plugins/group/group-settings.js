/**
 * @file Group management command handler
 * @module plugins/group/group
 * @license Apache-2.0
 * @author Naruya Izumi
 */

import {
    isSameWhatsAppUser,
    resolveGroupTarget,
} from "#core/resolve-target.js";

const ACTION_ALIASES = {
    open: "open",
    o: "open",
    mute: "close",
    unmute: "open",
    "فتح": "open",
    close: "close",
    c: "close",
    "إغلاق": "close",
    add: "add",
    a: "add",
    "إضافة": "add",
    "اضافة": "add",
    kick: "kick",
    k: "kick",
    "طرد": "kick",
    promote: "promote",
    p: "promote",
    "ترقية": "promote",
    demote: "demote",
    d: "demote",
    "خفض": "demote",
    link: "link",
    l: "link",
    gclink: "link",
    "رابط": "link",
    revoke: "revoke",
    r: "revoke",
    "إلغاء": "revoke",
};

let handler = async (m, { sock, args, usedPrefix, command, participants, groupMetadata }) => {
    const directAction = ACTION_ALIASES[command.toLowerCase()];
    const rawSubcommand = directAction || (args[0] || "").toLowerCase();
    const subcommand = ACTION_ALIASES[rawSubcommand] || rawSubcommand;
    const targetArgument = directAction ? args.join(" ") : args.slice(1).join(" ");
    let targetLookupIssue = null;
    const primaryOwner =
        global.config?.primaryOwner || global.config?.owner?.[0] || "";

    if (!subcommand) {
        return m.reply("أوامر المجموعة: add، kick، ترقية، خفض، فتح، إغلاق، رابط، إلغاء.");
    }

    const getTargetUser = async (arg, requireExisting = false) => {
        const result = await resolveGroupTarget(sock, participants, m, arg, {
            allowExternal: !requireExisting,
        });
        if (result.ambiguous) targetLookupIssue = "ambiguous";
        return result.jid;
    };

    const isPrimaryOwnerTarget = (target) =>
        isSameWhatsAppUser(sock, target, primaryOwner, participants);

    const refusePrimaryTarget = async (target) => {
        if (!(await isPrimaryOwnerTarget(target))) return false;
        await m.reply("ممنوع استخدام الأوامر ضد المالك الأول.");
        return true;
    };

    const updateParticipant = async (target, action) => {
        const result = await sock.groupParticipantsUpdate(m.chat, [target], action);
        const participantResult = Array.isArray(result)
            ? result.find((entry) => entry?.jid === target) || result[0]
            : null;
        const status =
            participantResult?.status === undefined
                ? ""
                : String(participantResult.status);

        if (status === "200") return true;

        if (status === "401" || status === "403") {
            await m.reply("رفض واتساب العملية. تأكد أن البوت مشرف في المجموعة.");
        } else if (status === "404") {
            await m.reply("لم يعثر واتساب على العضو المطلوب في المجموعة.");
        } else {
            await m.reply("لم يؤكد واتساب تنفيذ العملية. تحقق من العضو وصلاحيات المجموعة.");
        }

        return false;
    };

    try {
        if (subcommand === "o" || subcommand === "open") {
            await sock.groupSettingUpdate(m.chat, "not_announcement");
                return m.reply("تم فتح المجموعة أمام جميع الأعضاء.");
        }

        if (subcommand === "c" || subcommand === "close") {
            await sock.groupSettingUpdate(m.chat, "announcement");
                return m.reply("تم قصر إرسال الرسائل على المشرفين.");
        }

        if (subcommand === "a" || subcommand === "add") {
            const t = await getTargetUser(targetArgument);
            if (!t) {
                if (targetLookupIssue === "ambiguous") {
                    return m.reply("الاسم غير محدد؛ استخدم رقم الهاتف.");
                }
                const addCommand = directAction
                    ? `${usedPrefix + command} <اسم أو رقم>`
                    : `${usedPrefix + command} add <اسم أو رقم>`;
                return m.reply(`استخدم ${addCommand}.`);
            }

            if (await refusePrimaryTarget(t)) return;
            if (!(await updateParticipant(t, "add"))) return;
            return m.reply("تم اضافته");
        }

        if (subcommand === "k" || subcommand === "kick") {
            const t = await getTargetUser(targetArgument, true);
            if (!t) {
                const kickCommand = directAction
                    ? `${usedPrefix + command} <اسم أو رقم>`
                    : `${usedPrefix + command} kick <اسم أو رقم>`;
                return m.reply(`استخدم ${kickCommand} لعضو في المجموعة.`);
            }

            if (await refusePrimaryTarget(t)) return;
            if (!(await updateParticipant(t, "remove"))) return;
            return sock.sendMessage(
                m.chat,
                { text: `تم طرد @${t.split("@")[0]}`, mentions: [t] },
                { quoted: m }
            );
        }

        if (subcommand === "p" || subcommand === "promote") {
            const t = await getTargetUser(targetArgument, true);
            if (!t) {
                return m.reply(`استخدم ${usedPrefix + command} ترقية <اسم أو رقم>.`);
            }

            if (await refusePrimaryTarget(t)) return;
            if (!(await updateParticipant(t, "promote"))) return;
            return sock.sendMessage(
                m.chat,
                { text: `تمت ترقية @${t.split("@")[0]} إلى مشرف`,
                    mentions: [t] },
                { quoted: m }
            );
        }

        if (subcommand === "d" || subcommand === "demote") {
            const t = await getTargetUser(targetArgument, true);
            if (!t) {
                return m.reply(`استخدم ${usedPrefix + command} خفض <اسم أو رقم>.`);
            }

            if (await refusePrimaryTarget(t)) return;
            if (!(await updateParticipant(t, "demote"))) return;
            return sock.sendMessage(
                m.chat,
                { text: `أُزيلت صلاحية الإشراف عن @${t.split("@")[0]}`,
                    mentions: [t] },
                { quoted: m }
            );
        }

        if (subcommand === "l" || subcommand === "link") {
            const invite = await sock.groupInviteCode(m.chat);
            const link = `https://chat.whatsapp.com/${invite}`;
            await sock.client(m.chat, {
                text: `المجموعة: ${groupMetadata.subject}\nالمعرّف: ${m.chat}`,
                title: "رابط المجموعة",
                footer: "اضغط لنسخ الرابط",
                interactiveButtons: [{
                    name: "cta_copy",
                    buttonParamsJson: JSON.stringify({
                        display_text: "نسخ الرابط",
                        copy_code: link
                    })
                }]
            });
            return;
        }

        if (subcommand === "r" || subcommand === "revoke") {
            await sock.groupRevokeInvite(m.chat);
                return m.reply("تم إلغاء رابط الدعوة وإنشاء رابط جديد.");
        }

        return m.reply(`الأمر الفرعي غير معروف. الأوامر المتاحة:
- فتح أو إغلاق المجموعة
- إضافة عضو أو طرده
- ترقية عضو أو إزالة إشرافه
- عرض رابط المجموعة أو إلغاؤه`);
    } catch (e) {
        global.logger?.error(e, "Group command failed");
        return m.reply("تعذّر تنفيذ أمر المجموعة. تحقق من صلاحيات البوت وحاول مرة أخرى.");
    }
};

handler.help = ["group", "g", "add", "kick", "promote", "demote", "mute", "unmute", "gclink", "مجموعة"];
handler.tags = ["group"];
handler.command = /^(g|group|add|kick|promote|demote|mute|unmute|gclink|مجموعة)$/iu;
handler.group = true;
handler.botAdmin = true;
handler.admin = true;

export default handler;