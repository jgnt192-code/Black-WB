import getppCommand from "../../imported-commands/getpp.js";

const handler = async (m, { sock, args }) => {
    const contextInfo = m.message?.extendedTextMessage?.contextInfo;
    const hasTarget = Boolean(contextInfo?.mentionedJid?.length || contextInfo?.participant);

    if (!hasTarget && args[0]) {
        const digits = args[0].replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15) {
            return m.reply("> ⚠️ Invalid number format");
        }
    }

    return getppCommand(m, sock);
};

handler.help = ["getpp"];
handler.tags = ["tools"];
handler.command = /^getpp$/iu;

export default handler;
