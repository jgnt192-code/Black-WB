import { afterEach, describe, expect, test } from "bun:test";
import { handler } from "../src/handler.js";
import groupSettings from "../src/plugins/group/group-settings.js";
import { serialize } from "../src/lib/core/message.js";

serialize();

describe("group command dispatch", () => {
    const original = {};

    afterEach(() => {
        for (const key of ["config", "plugins", "logger", "dfail"]) {
            global[key] = original[key];
        }
    });

    test("kick fetches group participants when the chat cache is empty", async () => {
        original.config = global.config;
        original.plugins = global.plugins;
        original.logger = global.logger;
        original.dfail = global.dfail;

        const group = "12345@g.us";
        const actor = "actor@lid";
        const bot = "bot@lid";
        const target = "target@lid";
        const calls = [];
        const metadata = {
            subject: "Test group",
            participants: [
                { id: actor, admin: "admin" },
                { id: bot, admin: "admin" },
                { id: target, admin: null },
            ],
        };

        global.config = { owner: [], self: false };
        global.plugins = { "group/group-settings.js": groupSettings };
        global.logger = { info() {}, debug() {}, error() {} };
        global.dfail = async (...args) => calls.push(["denied", ...args]);

        const sock = {
            prefix: ".",
            user: { id: bot },
            pushMessage() {},
            decodeJid: (jid) => jid,
            getChat: async () => undefined,
            groupMetadata: async (jid) => {
                calls.push(["metadata", jid]);
                return metadata;
            },
            setChat: async (...args) => calls.push(["cache", ...args]),
            signalRepository: {
                lidMapping: {
                    getLIDForPN: async () => target,
                },
            },
            groupParticipantsUpdate: async (...args) => {
                calls.push(["update", ...args]);
                return [{ jid: target, status: "200" }];
            },
            sendMessage: async (...args) => calls.push(["send", ...args]),
            reply: async (...args) => calls.push(["reply", ...args]),
            getName: async () => "Moderator",
        };

        await handler.call(sock, {
            messages: [
                {
                    key: {
                        remoteJid: group,
                        participant: actor,
                        id: "test-message",
                        fromMe: false,
                    },
                    message: { conversation: ".kick 218912345678" },
                    pushName: "Moderator",
                },
            ],
        });

        expect(calls.find((call) => call[0] === "metadata")).toEqual([
            "metadata",
            group,
        ]);
        expect(calls.find((call) => call[0] === "update")).toEqual([
            "update",
            group,
            [target],
            "remove",
        ]);
        expect(calls.find((call) => call[0] === "denied")).toBeUndefined();
        expect(calls.find((call) => call[0] === "cache")?.[2]?.metadata).toBe(
            metadata
        );
    });
});
