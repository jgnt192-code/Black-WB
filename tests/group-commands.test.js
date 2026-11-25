import { describe, expect, test } from "bun:test";
import { findGroupParticipant } from "../src/lib/core/group-participants.js";
import groupSettings from "../src/plugins/group/group-settings.js";
import menuHandler from "../src/plugins/info/info-menu.js";
import {
    clampRepeatMessageLimit,
    MAX_REPEAT_MESSAGES,
} from "../src/lib/core/repeat-loop.js";

describe("group participant resolution", () => {
    test("maps a phone JID to the matching LID participant", async () => {
        const participant = { id: "5511999999999@lid", admin: "admin" };
        const sock = {
            decodeJid: (jid) => jid.replace(/:\d+@/u, "@"),
            signalRepository: {
                lidMapping: {
                    getLIDForPN: async () => participant.id,
                },
            },
        };

        const result = await findGroupParticipant(
            sock,
            [participant],
            "5511999999999@s.whatsapp.net"
        );

        expect(result).toEqual(participant);
    });

    test("kick resolves the target before calling the group action", async () => {
        const target = "5511999999999@lid";
        const calls = [];
        const sent = [];
        const sock = {
            decodeJid: (jid) => jid,
            signalRepository: {
                lidMapping: {
                    getLIDForPN: async () => target,
                },
            },
            groupParticipantsUpdate: async (...args) => {
                calls.push(args);
                return [{ status: "200", jid: target }];
            },
            sendMessage: async (...args) => sent.push(args),
        };
        const m = {
            chat: "12345@g.us",
            mentionedJid: ["5511999999999@s.whatsapp.net"],
            quoted: null,
            reply: async (text) => sent.push(text),
        };

        await groupSettings(m, {
            sock,
            args: ["+5511999999999"],
            command: "kick",
            usedPrefix: ".",
            participants: [{ id: target, admin: null }],
            groupMetadata: { subject: "Test group" },
        });

        expect(calls).toEqual([[m.chat, [target], "remove"]]);
        expect(sent[0][1].text).toContain("تم طرد");
        expect(sent[0][1].mentions).toEqual([target]);
    });

    test("group kick subcommand resolves an entered phone number", async () => {
        const target = "5511999999999@lid";
        const calls = [];
        const sock = {
            decodeJid: (jid) => jid,
            signalRepository: {
                lidMapping: {
                    getLIDForPN: async () => target,
                },
            },
            groupParticipantsUpdate: async (...args) => {
                calls.push(args);
                return [{ status: "200", jid: target }];
            },
            sendMessage: async () => {},
        };

        await groupSettings(
            {
                chat: "12345@g.us",
                mentionedJid: [],
                quoted: null,
                reply: async () => {},
            },
            {
                sock,
                args: ["kick", "5511999999999"],
                command: "group",
                usedPrefix: ".",
                participants: [{ id: target, admin: null }],
                groupMetadata: { subject: "Test group" },
            }
        );

        expect(calls).toEqual([["12345@g.us", [target], "remove"]]);
    });

    test("reports a denied group action instead of claiming success", async () => {
        const target = "5511999999999@lid";
        const replies = [];
        let sentSuccess = false;
        const sock = {
            decodeJid: (jid) => jid,
            signalRepository: {
                lidMapping: {
                    getLIDForPN: async () => target,
                },
            },
            groupParticipantsUpdate: async () => [{ status: 403, jid: target }],
            sendMessage: async () => {
                sentSuccess = true;
            },
        };
        const m = {
            chat: "12345@g.us",
            mentionedJid: ["5511999999999@s.whatsapp.net"],
            quoted: null,
            reply: async (text) => replies.push(text),
        };

        await groupSettings(m, {
            sock,
            args: ["5511999999999"],
            command: "kick",
            usedPrefix: ".",
            participants: [{ id: target, admin: null }],
            groupMetadata: { subject: "Test group" },
        });

        expect(sentSuccess).toBe(false);
        expect(replies[0]).toContain("تأكد أن البوت مشرف");
    });

    test("add accepts an absent participant phone number", async () => {
        const calls = [];
        const sock = {
            decodeJid: (jid) => jid,
            signalRepository: {
                lidMapping: {
                    getLIDForPN: async () => null,
                },
            },
            groupParticipantsUpdate: async (...args) => {
                calls.push(args);
                return [{ status: 200, jid: args[1][0] }];
            },
            sendMessage: async () => {},
        };
        const m = {
            chat: "12345@g.us",
            mentionedJid: [],
            quoted: null,
            reply: async () => {},
        };

        await groupSettings(m, {
            sock,
            args: ["add", "+5511999999999"],
            command: "group",
            usedPrefix: ".",
            participants: [],
            groupMetadata: { subject: "Test group" },
        });

        expect(calls).toEqual([
            [m.chat, ["5511999999999@s.whatsapp.net"], "add"],
        ]);
    });

    test("standalone add command adds a phone number and replies with the requested text", async () => {
        const target = "5511999999999@s.whatsapp.net";
        const calls = [];
        const replies = [];
        const sock = {
            groupParticipantsUpdate: async (...args) => {
                calls.push(args);
                return [{ status: "200", jid: target }];
            },
        };
        const m = {
            chat: "12345@g.us",
            mentionedJid: [],
            quoted: null,
            reply: async (text) => replies.push(text),
        };

        await groupSettings(m, {
            sock,
            args: ["+55 (11) 99999-9999"],
            command: "add",
            usedPrefix: ".",
            participants: [],
            groupMetadata: { subject: "Test group" },
        });

        expect(calls).toEqual([
            [m.chat, [target], "add"],
        ]);
        expect(replies).toEqual(["تم اضافته"]);
    });

    test("standalone add command resolves a known WhatsApp username", async () => {
        const target = "5511999999999@s.whatsapp.net";
        const calls = [];
        const replies = [];
        const sock = {
            getChats: () => [{ id: target, username: "jamie" }],
            groupParticipantsUpdate: async (...args) => {
                calls.push(args);
                return [{ status: "200", jid: target }];
            },
        };
        const m = {
            chat: "12345@g.us",
            mentionedJid: [],
            quoted: null,
            reply: async (text) => replies.push(text),
        };

        await groupSettings(m, {
            sock,
            args: ["@Jamie"],
            command: "add",
            usedPrefix: ".",
            participants: [],
            groupMetadata: { subject: "Test group" },
        });

        expect(calls).toEqual([
            [m.chat, [target], "add"],
        ]);
        expect(replies).toEqual(["تم اضافته"]);
    });

    test("unknown plain names are not sent as invalid WhatsApp identifiers", async () => {
        const calls = [];
        const replies = [];
        const sock = {
            getChats: () => [],
            groupParticipantsUpdate: async (...args) => calls.push(args),
        };
        const m = {
            chat: "12345@g.us",
            mentionedJid: [],
            quoted: null,
            reply: async (text) => replies.push(text),
        };

        await groupSettings(m, {
            sock,
            args: ["someone-not-in-contacts"],
            command: "add",
            usedPrefix: ".",
            participants: [],
            groupMetadata: { subject: "Test group" },
        });

        expect(calls).toHaveLength(0);
        expect(replies[0]).toContain("استخدم .add");
    });

    test("standalone add command accepts a WhatsApp mention", async () => {
        const target = "5511999999999@lid";
        const calls = [];
        const replies = [];
        const sock = {
            groupParticipantsUpdate: async (...args) => {
                calls.push(args);
                return [{ status: "200", jid: target }];
            },
        };
        const m = {
            chat: "12345@g.us",
            mentionedJid: [target],
            quoted: null,
            reply: async (text) => replies.push(text),
        };

        await groupSettings(m, {
            sock,
            args: ["@member"],
            command: "add",
            usedPrefix: ".",
            participants: [],
            groupMetadata: { subject: "Test group" },
        });

        expect(calls).toEqual([
            [m.chat, [target], "add"],
        ]);
        expect(replies).toEqual(["تم اضافته"]);
    });

    test("group administration commands require group admin permissions", () => {
        expect(groupSettings.group).toBe(true);
        expect(groupSettings.admin).toBe(true);
        expect(groupSettings.botAdmin).toBe(true);
    });

    test("group commands cannot target the primary owner", async () => {
        const originalConfig = global.config;
        const primary = "218912345678@s.whatsapp.net";
        const updates = [];
        const replies = [];
        const sock = {
            decodeJid: (jid) => jid,
            groupParticipantsUpdate: async (...args) => updates.push(args),
        };
        const participants = [{ id: primary, admin: "admin" }];

        global.config = { owner: [], primaryOwner: "+218912345678" };
        try {
            for (const command of ["add", "kick", "promote", "demote"]) {
                await groupSettings(
                    {
                        chat: "12345@g.us",
                        mentionedJid: [],
                        quoted: null,
                        reply: async (text) => replies.push(text),
                    },
                    {
                        sock,
                        args: ["+218912345678"],
                        command,
                        usedPrefix: ".",
                        participants,
                        groupMetadata: { subject: "Test group" },
                    }
                );
            }
        } finally {
            global.config = originalConfig;
        }

        expect(updates).toHaveLength(0);
        expect(replies).toHaveLength(4);
        expect(replies.every((text) => text === "ممنوع استخدام الأوامر ضد المالك الأول.")).toBe(
            true
        );
    });
});

describe("repeat command safety limit", () => {
    test("caps message runs at ten", () => {
        expect(MAX_REPEAT_MESSAGES).toBe(10);
        expect(clampRepeatMessageLimit(50)).toBe(10);
        expect(clampRepeatMessageLimit(4)).toBe(4);
        expect(clampRepeatMessageLimit(0)).toBe(10);
    });
});

describe("WhatsApp menu adaptation", () => {
    test("lists active commands and omits unsupported Telegram commands", async () => {
        const original = {
            config: global.config,
            plugins: global.plugins,
            loading: global.loading,
        };
        const messages = [];
        global.config = { watermark: "Bot", author: "Owner" };
        global.plugins = {
            "info/info-menu.js": { help: ["menu"] },
            "info/info-ping.js": { help: ["ping"] },
            "group/group-settings.js": { help: ["kick"] },
            "owner/owner-getconfig.js": { help: ["getconfig"] },
        };
        global.loading = async () => {};

        try {
            await menuHandler(
                {
                    chat: "12345@g.us",
                    pushName: "Tester",
                    reply: async (text) => messages.push(text),
                },
                {
                    sock: { sendMessage: async (...args) => messages.push(args) },
                    usedPrefix: ".",
                    isOwner: false,
                }
            );

            const menuText = messages[0][1].text;
            expect(menuText).toContain(".kick");
            expect(menuText).toContain(".ping");
            expect(menuText).not.toContain("connect");
            expect(menuText).not.toContain("addprem");
        } finally {
            global.config = original.config;
            global.plugins = original.plugins;
            global.loading = original.loading;
        }
    });
});
