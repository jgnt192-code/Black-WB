const escapeVCard = (value) =>
    String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");

const handler = async (m, { sock }) => {
    const configuredOwners = Array.isArray(global.config?.owner)
        ? global.config.owner
        : [global.config?.owner];
    const phone = configuredOwners
        .map((owner) =>
            String(owner || "")
                .split("@", 1)[0]
                .split(":", 1)[0]
                .replace(/\D/g, "")
        )
        .find((number) => number.length >= 5);

    if (!phone) {
        return m.reply("رقم مالك البوت غير مضبوط في الإعدادات.");
    }

    const name = String(global.config?.author || "مالك البوت");
    const safeName = escapeVCard(name);
    const vcard = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${safeName}`,
        `ORG:${safeName};`,
        `TEL;type=CELL;type=VOICE;waid=${phone}:+${phone}`,
        "END:VCARD",
    ].join("\n");

    return sock.sendMessage(
        m.chat,
        {
            contacts: {
                displayName: name,
                contacts: [{ vcard }],
            },
        },
        { quoted: m }
    );
};

handler.help = ["owner", "مالك"];
handler.tags = ["info"];
handler.command = /^(owner|مالك)$/iu;

export default handler;
