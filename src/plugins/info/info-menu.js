const BOT_PLUGINS = [
    "info/info-menu.js",
    "info/info-ping.js",
    "info/info-getid.js",
    "info/info-owner.js",
    "games/games.js",
    "ai/ai-openai.js",
    "info/info-wiki.js",
    "tool/tool-device.js",
    "tool/tool-fancy.js",
    "tool/tool-getpp.js",
    "tool/tool-react.js",
    "downloader/downloader-ytplay.js",
    "downloader/downloader-download.js",
    "maker/maker-sticker.js",
    "tool/tool-convert.js",
];

const GROUP_PLUGINS = [
    "group/group-settings.js",
    "group/group-hidetag.js",
    "group/group-tagadmin.js",
    "group/group-delete.js",
];

const OWNER_PLUGINS = [
    "owner/owner-getconfig.js",
    "owner/owner-online.js",
    "owner/owner-setpp.js",
    "owner/owner-addme.js",
];

const listCommands = (pluginNames, prefix) =>
    pluginNames.flatMap((name) => {
        const plugin = global.plugins?.[name];
        if (!plugin || plugin.disabled || plugin.hiddenFromMenu) return [];
        return [].concat(plugin.help || []).map((command) => `│ ⬢ ${prefix}${command}`);
    });

const makeSection = (title, commands, note = "") => {
    if (!commands.length) return [];
    return [
        `╭─[ ✧ ${title} ✧ ]──╮`,
        "│",
        ...commands,
        ...(note ? [`│`, `│ ${note}`] : []),
        "╰─────────────────╯",
    ];
};

const handler = async (m, { sock, usedPrefix, isOwner }) => {
    await global.loading(m, sock);

    try {
        const pkg = await Bun.file("./package.json").json();
        const now = new Date();
        const day = new Intl.DateTimeFormat("en", { weekday: "long" }).format(now);
        const date = new Intl.DateTimeFormat("en-GB").format(now);
        const userName = m.pushName || "عضو";
        const botName = global.config.watermark;
        const author = global.config.author;
        const pluginCount = Object.values(global.plugins || {}).filter(
            (plugin) => plugin && !plugin.disabled
        ).length;

        const sections = [
            ...makeSection("BOT CMD", listCommands(BOT_PLUGINS, usedPrefix)),
            ...makeSection(
                "GROUP CMD",
                listCommands(GROUP_PLUGINS, usedPrefix),
                "أوامر المجموعات للمشرفين، وتتطلب صلاحيات البوت."
            ),
        ];

        if (isOwner) {
            sections.push(
                ...makeSection("OWNER CMD", listCommands(OWNER_PLUGINS, usedPrefix))
            );
        }

        const text = [
            "╭─────────────────╮",
            `      ༒ ${botName} ༒`,
            "╰─────────────────╯",
            "╭─────────────────╮",
            `│ أهلًا، ${userName}`,
            `│ Day : ${day}`,
            `│ Date : ${date}`,
            `│ Version : ${pkg.version}`,
            `│ Plugins : ${pluginCount}`,
            "╰─────────────────╯",
            "",
            ...sections,
            "",
            `استخدم ${usedPrefix}menu لعرض القائمة.`,
            `Powered By ${author}`,
        ].join("\n");

        return sock.sendMessage(m.chat, { text }, { quoted: m });
    } catch (error) {
        global.logger?.error({ error: error?.message }, "Menu display failed");
        return m.reply("تعذّر عرض القائمة الآن. حاول مرة أخرى لاحقًا.");
    } finally {
        await global.loading(m, sock, true);
    }
};

handler.help = ["menu", "help", "start", "info", "قائمة", "مساعدة"];
handler.tags = ["info"];
handler.command = /^(menu|help|start|info|قائمة|مساعدة)$/iu;

export default handler;
