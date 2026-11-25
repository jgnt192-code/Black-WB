/**
 * Restart the bot's WhatsApp socket.
 * @license Apache-2.0
 */

const handler = async (m) => {
    if (typeof global.reloadHandler !== "function") {
        return m.reply("تعذرت إعادة تشغيل البوت.");
    }

    await m.reply("جارٍ إعادة تشغيل البوت.");
    try {
        const restarted = await global.reloadHandler(true);
        if (restarted === false) {
            return m.reply("تعذرت إعادة تشغيل اتصال البوت.");
        }
    } catch (error) {
        global.logger?.error({ error: error?.message }, "Bot restart command failed");
        return m.reply("فشلت إعادة تشغيل اتصال البوت. تحقق من سجل التشغيل.");
    }
};

handler.help = ["rest"];
handler.tags = ["owner"];
handler.command = /^(rest|restart)$/iu;
handler.owner = true;
handler.silentUnauthorized = true;

export default handler;
