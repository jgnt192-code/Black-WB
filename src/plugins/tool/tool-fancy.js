import fancyCommand from "../../imported-commands/fancy.js";

const handler = async (m, { sock, args }) => {
    if (args.length > 0 && !/^\d+$/u.test(args[0])) {
        return m.reply("استخدم .fancy لعرض الأنماط أو .fancy <رقم> <النص>.");
    }
    if (Array.from(args.slice(1).join(" ")).length > 1200) {
        return m.reply("النص طويل جدًا؛ الحد الأقصى 1200 حرف.");
    }

    return fancyCommand(m, sock);
};

handler.help = ["fancy"];
handler.tags = ["tools"];
handler.command = /^fancy$/iu;

export default handler;
