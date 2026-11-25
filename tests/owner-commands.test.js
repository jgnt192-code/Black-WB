import { afterEach, describe, expect, test } from "bun:test";
import { getBotSettings, updateBotSettings } from "../src/lib/bot-settings.js";
import addAdmin from "../src/plugins/owner/addadmin.js";
import dladmin from "../src/plugins/owner/dladmin.js";
import rest from "../src/plugins/owner/rest.js";

describe("bot owner commands", () => {
    const originalConfig = global.config;
    const originalReloadHandler = global.reloadHandler;
    const originalLogger = global.logger;

    const withBotOwners = async (owners, run) => {
        const initialSettings = await getBotSettings();
        await updateBotSettings((settings) => ({
            ...settings,
            botOwners: owners,
        }));
        try {
            await run();
        } finally {
            await updateBotSettings((settings) => ({
                ...settings,
                botOwners: initialSettings.botOwners || [],
            }));
        }
    };

    afterEach(() => {
        global.config = originalConfig;
        global.reloadHandler = originalReloadHandler;
        global.logger = originalLogger;
    });

    test("addadmin saves a known username as a persistent bot owner", async () => {
        const initialSettings = await getBotSettings();
        const target = "added-owner-test@lid";
        const replies = [];
        const sock = {
            getChats: () => [{ id: target, username: "test-helper" }],
        };
        global.config = {
            owner: [],
            primaryOwner: "first-owner@s.whatsapp.net",
        };

        try {
            await addAdmin(
                {
                    chat: "test-chat@s.whatsapp.net",
                    mentionedJid: [],
                    quoted: null,
                    reply: async (text) => replies.push(text),
                },
                {
                    sock,
                    text: "test-helper",
                    participants: [],
                    usedPrefix: ".",
                }
            );

            expect((await getBotSettings()).botOwners).toContain(target);
            expect(replies).toEqual(["تمت إضافته إلى مالكي البوت."]);
        } finally {
            await updateBotSettings((settings) => ({
                ...settings,
                botOwners: initialSettings.botOwners || [],
            }));
        }
    });

    test("rest reconnects the bot socket and sends one short status", async () => {
        let restartedWithSocket = false;
        const replies = [];
        global.reloadHandler = async (restartSocket) => {
            restartedWithSocket = restartSocket;
        };

        await rest(
            { reply: async (text) => replies.push(text) },
            {}
        );

        expect(restartedWithSocket).toBe(true);
        expect(replies).toEqual(["جارٍ إعادة تشغيل البوت."]);
    });

    test("rest reports a reconnect failure instead of leaving an unhandled error", async () => {
        const replies = [];
        global.reloadHandler = async () => {
            throw new Error("socket unavailable");
        };
        global.logger = { error() {} };

        await rest({ reply: async (text) => replies.push(text) }, {});

        expect(replies).toEqual([
            "جارٍ إعادة تشغيل البوت.",
            "فشلت إعادة تشغيل اتصال البوت. تحقق من سجل التشغيل.",
        ]);
    });

    test("dladmin lists the primary owner visibly as protected", async () => {
        await withBotOwners(["added-owner@s.whatsapp.net"], async () => {
            global.config = {
                owner: [
                    "primary-owner@s.whatsapp.net",
                    "configured-owner@s.whatsapp.net",
                ],
                primaryOwner: "primary-owner@s.whatsapp.net",
            };
            const replies = [];
            const sock = { decodeJid: (jid) => jid };

            await dladmin(
                {
                    chat: "owner-chat@s.whatsapp.net",
                    sender: "primary-owner@s.whatsapp.net",
                    isGroup: false,
                    mentionedJid: [],
                    quoted: null,
                    reply: async (text) => {
                        replies.push(text);
                        return { key: { id: "owner-list-message" } };
                    },
                },
                {
                    sock,
                    text: "",
                    participants: [],
                    usedPrefix: ".",
                }
            );

            expect(replies).toHaveLength(1);
            expect(replies[0]).toContain("1. primary-owner@s.whatsapp.net — أساسي (محمي)");
            expect(replies[0]).toContain("configured-owner@s.whatsapp.net");
            expect(replies[0]).toContain("3. added-owner@s.whatsapp.net — قابل للحذف");
            expect(replies[0].match(/primary-owner@s\.whatsapp\.net/gu)).toHaveLength(1);

            const unauthorizedReplies = [];
            await dladmin.all.call(sock, {
                chat: "owner-chat@s.whatsapp.net",
                sender: "other-user@s.whatsapp.net",
                isGroup: false,
                fromMe: false,
                text: "3",
                quoted: { id: "owner-list-message" },
                reply: async (text) => unauthorizedReplies.push(text),
            });
            expect(unauthorizedReplies).toHaveLength(0);
            expect((await getBotSettings()).botOwners).toContain(
                "added-owner@s.whatsapp.net"
            );

            const deleteReplies = [];
            await dladmin.all.call(sock, {
                chat: "owner-chat@s.whatsapp.net",
                sender: "primary-owner@s.whatsapp.net",
                isGroup: false,
                fromMe: false,
                text: "3",
                quoted: { id: "owner-list-message" },
                reply: async (text) => deleteReplies.push(text),
            });
            expect(deleteReplies).toEqual(["تم الحذف."]);
            expect((await getBotSettings()).botOwners).not.toContain(
                "added-owner@s.whatsapp.net"
            );
        });
    });

    test("dladmin number replies cannot remove the primary owner", async () => {
        await withBotOwners(
            ["added-owner@s.whatsapp.net", "primary-owner@s.whatsapp.net"],
            async () => {
                global.config = {
                    owner: [],
                    primaryOwner: "primary-owner@s.whatsapp.net",
                };
                const sock = { decodeJid: (jid) => jid };

                await dladmin(
                    {
                        chat: "primary-owner@s.whatsapp.net",
                        sender: "primary-owner@s.whatsapp.net",
                        isGroup: false,
                        mentionedJid: [],
                        quoted: null,
                        reply: async () => ({
                            key: { id: "protected-list-message" },
                        }),
                    },
                    {
                        sock,
                        text: "",
                        participants: [],
                        usedPrefix: ".",
                    }
                );

                const replies = [];
                await dladmin.all.call(sock, {
                    chat: "primary-owner@s.whatsapp.net",
                    sender: "primary-owner@s.whatsapp.net",
                    isGroup: false,
                    fromMe: false,
                    text: "1",
                    quoted: { id: "protected-list-message" },
                    reply: async (text) => replies.push(text),
                });

                expect(replies).toEqual(["محمي."]);
                expect((await getBotSettings()).botOwners).toContain(
                    "primary-owner@s.whatsapp.net"
                );
            }
        );
    });

    test("dladmin refuses to remove the primary owner", async () => {
        await withBotOwners(["primary-owner@s.whatsapp.net"], async () => {
            global.config = {
                owner: [],
                primaryOwner: "primary-owner@s.whatsapp.net",
            };
            const replies = [];

            await dladmin(
                {
                    chat: "owner-chat@s.whatsapp.net",
                    isGroup: false,
                    mentionedJid: [],
                    quoted: null,
                    reply: async (text) => replies.push(text),
                },
                {
                    sock: {},
                    text: "primary-owner@s.whatsapp.net",
                    participants: [],
                    usedPrefix: ".",
                }
            );

            expect(replies).toEqual([
                "محمي.",
            ]);
            expect((await getBotSettings()).botOwners).toContain(
                "primary-owner@s.whatsapp.net"
            );
        });
    });

    test("dladmin removes a saved owner but not an environment owner", async () => {
        await withBotOwners(
            ["saved-owner@s.whatsapp.net", "configured-owner@s.whatsapp.net"],
            async () => {
                global.config = {
                    owner: ["configured-owner@s.whatsapp.net"],
                    primaryOwner: "primary-owner@s.whatsapp.net",
                };
                const replies = [];
                const sock = {};

                await dladmin(
                    {
                        chat: "owner-chat@s.whatsapp.net",
                        isGroup: false,
                        mentionedJid: ["saved-owner@s.whatsapp.net"],
                        quoted: null,
                        reply: async (text) => replies.push(text),
                    },
                    {
                        sock,
                        text: "",
                        participants: [],
                        usedPrefix: ".",
                    }
                );

                expect(replies).toEqual([
                    "تم الحذف.",
                ]);
                expect((await getBotSettings()).botOwners).toEqual([
                    "configured-owner@s.whatsapp.net",
                ]);

                replies.length = 0;
                await dladmin(
                    {
                        chat: "owner-chat@s.whatsapp.net",
                        isGroup: false,
                        mentionedJid: [],
                        quoted: null,
                        reply: async (text) => replies.push(text),
                    },
                    {
                        sock,
                        text: "configured-owner@s.whatsapp.net",
                        participants: [],
                        usedPrefix: ".",
                    }
                );

                expect(replies).toEqual([
                    "محمي من الحذف.",
                ]);
            }
        );
    });

    test("dladmin is owner-only and lists no owners in group chats", async () => {
        expect(dladmin.owner).toBe(true);
        expect(dladmin.command.test("dladmin")).toBe(true);
        const replies = [];

        await dladmin(
            {
                chat: "group@g.us",
                isGroup: true,
                reply: async (text) => replies.push(text),
            },
            { sock: {}, text: "", participants: [], usedPrefix: "." }
        );

        expect(replies).toEqual([
            "خاص فقط.",
        ]);
    });

    test("administrative commands are bot-owner-only", () => {
        expect(addAdmin.owner).toBe(true);
        expect(rest.owner).toBe(true);
        expect(dladmin.owner).toBe(true);
        expect(addAdmin.command.test("addadmin")).toBe(true);
        expect(dladmin.command.test("dladmin")).toBe(true);
        expect(rest.command.test("rest")).toBe(true);
    });
});
