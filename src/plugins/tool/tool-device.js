import deviceCommand from "../../imported-commands/device.js";

const handler = async (m, { sock }) => {
    const stanzaId = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (!stanzaId) return m.reply("رد على رسالة باستخدام .device.");

    return deviceCommand(m, sock);
};

handler.help = ["device"];
handler.tags = ["tools"];
handler.command = /^device$/iu;

export default handler;
