/**
 * @file Set the bot presence to available
 * @license Apache-2.0
 */

const handler = async (m, { sock }) => {
    try {
        await sock.sendPresenceUpdate("available");
        return m.reply("حالة البوت الآن: متصل.");
    } catch {
        return m.reply("تعذّر تحديث حالة الاتصال.");
    }
};

handler.help = ["online"];
handler.tags = ["owner"];
handler.command = /^online$/iu;
handler.owner = true;
handler.silentUnauthorized = true;

export default handler;
