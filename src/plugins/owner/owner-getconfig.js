/**
 * @file Show non-sensitive bot display settings
 * @license Apache-2.0
 */

const handler = async (m) => {
    const lines = [
        "*إعدادات العرض*",
        `الاسم الظاهر: ${global.config.watermark}`,
        `اسم حزمة الملصقات: ${global.config.stickpack}`,
        `ناشر الملصقات: ${global.config.stickauth}`,
        `وضع الخصوصية: ${global.config.self ? "خاص" : "عام"}`,
    ];
    return m.reply(lines.join("\n"));
};

handler.help = ["getconfig"];
handler.tags = ["owner"];
handler.command = /^getconfig$/iu;
handler.owner = true;
handler.silentUnauthorized = true;

export default handler;
