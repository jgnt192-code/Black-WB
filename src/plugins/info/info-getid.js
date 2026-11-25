/**
 * @file Group identifier command
 * @license Apache-2.0
 */

const handler = async (m) => {
    if (!m.isGroup) {
        return m.reply("استخدم هذا الأمر داخل مجموعة لعرض معرّفها.");
    }

    return m.reply(`معرّف المجموعة:\n${m.chat}`);
};

handler.help = ["gcid", "getid", "id"];
handler.tags = ["info"];
handler.command = /^(gcid|getid|id)$/iu;
handler.group = true;

export default handler;
