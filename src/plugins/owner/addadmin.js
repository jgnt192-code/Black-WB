/**
 * Add a bot owner by WhatsApp number, known username, reply, or mention.
 * @license Apache-2.0
 */

import { getBotSettings, updateBotSettings } from "#lib/bot-settings.js";
import {
    isSameWhatsAppUser,
    resolveGroupTarget,
} from "#core/resolve-target.js";

const handler = async (m, { sock, text, participants, usedPrefix }) => {
    const resolved = await resolveGroupTarget(sock, participants, m, text, {
        allowExternal: true,
    });
    if (resolved.ambiguous) return m.reply("الاسم غير محدد؛ استخدم رقم الهاتف.");
    if (!resolved.jid) {
        return m.reply(`استخدم ${usedPrefix}addadmin <اسم أو رقم>.`);
    }

    const primaryOwner =
        global.config?.primaryOwner ||
        global.config?.owner?.[0] ||
        sock.user?.lid ||
        sock.user?.id ||
        "";
    if (
        primaryOwner &&
        (await isSameWhatsAppUser(sock, resolved.jid, primaryOwner, participants))
    ) {
        return m.reply("لا يمكن تغيير المالك الأول.");
    }

    const settings = await getBotSettings();
    const owners = [...(global.config?.owner || []), ...(settings.botOwners || [])];
    for (const owner of owners) {
        if (await isSameWhatsAppUser(sock, resolved.jid, owner, participants)) {
            return m.reply("هذا المستخدم مالك بالفعل.");
        }
    }

    await updateBotSettings((current) => ({
        ...current,
        botOwners: [...new Set([...(current.botOwners || []), resolved.jid])],
    }));
    return m.reply("تمت إضافته إلى مالكي البوت.");
};

handler.help = ["addadmin <اسم أو رقم>"];
handler.tags = ["owner"];
handler.command = /^addadmin$/iu;
handler.owner = true;
handler.silentUnauthorized = true;

export default handler;
