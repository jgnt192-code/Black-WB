/**
 * @file Delete a replied-to group message
 * @license Apache-2.0
 */

import { isSameWhatsAppUser } from "#core/resolve-target.js";

const handler = async (m, { sock, participants }) => {
    if (!m.quoted) return m.reply("رد على رسالة تريد حذفها.");
    const primaryOwner =
        global.config?.primaryOwner || global.config?.owner?.[0] || "";
    if (
        primaryOwner &&
        (await isSameWhatsAppUser(sock, m.quoted.sender, primaryOwner, participants))
    ) {
        return m.reply("ممنوع استخدام الأوامر ضد المالك الأول.");
    }
    try {
        await m.quoted.delete();
        return;
    } catch {
        return m.reply("تعذّر حذف الرسالة. تحقق من صلاحيات البوت.");
    }
};

handler.help = ["dlt"];
handler.tags = ["group"];
handler.command = /^dlt$/iu;
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

export default handler;
