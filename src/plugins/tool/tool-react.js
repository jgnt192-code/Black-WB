import reactCommand from "../../imported-commands/react.js";

const handler = async (m, { sock, args }) => {
    const emoji = args.join(" ").trim() || "🥷🏽";
    const graphemes = [
        ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(emoji),
    ];
    const containsEmoji =
        /[\p{Extended_Pictographic}\p{Regional_Indicator}]|[0-9#*]\uFE0F?\u20E3/u.test(
            emoji
        );

    if (graphemes.length !== 1 || !containsEmoji) {
        return m.reply("أرسل رمزًا تعبيريًا واحدًا فقط، مثل: .react 🔥");
    }

    return reactCommand(m, sock, emoji);
};

handler.help = ["react [رمز تعبيري]"];
handler.tags = ["tools"];
handler.command = /^react$/iu;

export default handler;
