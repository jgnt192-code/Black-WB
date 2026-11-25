import pingCommand from "../../imported-commands/ping.js";

const handler = async (m, { sock }) => {
    return pingCommand(m, sock);
};

handler.help = ["ping", "فحص"];
handler.tags = ["info"];
handler.command = /^(ping|فحص)$/iu;

export default handler;
