/**
 * @file Mention group administrators
 * @license Apache-2.0
 */

const handler = async (m, { sock, participants, text }) => {
    const admins = participants
        .filter((participant) => participant.admin === "admin" || participant.admin === "superadmin")
        .map((participant) => participant.id);
    if (!admins.length) return m.reply("لم أجد مشرفين في بيانات المجموعة.");

    const names = admins.map((jid) => `@${jid.split("@")[0]}`).join(" ");
    return sock.sendMessage(
        m.chat,
        {
            text: `${names}${text ? `\n${text}` : ""}`,
            mentions: admins,
        },
        { quoted: m }
    );
};

handler.help = ["tagadmin"];
handler.tags = ["group"];
handler.command = /^tagadmin$/iu;
handler.group = true;
handler.admin = true;

export default handler;
