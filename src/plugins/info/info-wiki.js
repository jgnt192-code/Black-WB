import wikiCommands from "../../imported-commands/wiki.js";

const handler = async (m, { sock, args, command, usedPrefix }) => {
    const query = args.join(" ").trim();
    if (query.length > 180) {
        return m.reply("اجعل عبارة البحث أقصر من 180 حرفًا.");
    }

    return command === "wikifr"
        ? wikiCommands.wikifr(m, sock)
        : wikiCommands.wikien(m, sock);
};

handler.help = ["wiki", "wikifr"];
handler.tags = ["tools"];
handler.command = /^(wiki|wikifr)$/iu;

export default handler;
