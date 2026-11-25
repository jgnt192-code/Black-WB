import { describe, expect, test } from "bun:test";
import reactCommand from "../src/plugins/tool/tool-react.js";

describe("reaction command", () => {
    test("uses the requested emoji", async () => {
        const sent = [];
        const message = {
            key: { id: "message-1", remoteJid: "chat@g.us" },
            reply: async () => {
                throw new Error("unexpected reply");
            },
        };

        await reactCommand(message, {
            sock: { sendMessage: async (...args) => sent.push(args) },
            args: ["🔥"],
        });

        expect(sent[0][1].react.text).toBe("🔥");
        expect(sent[0][1].react.key).toBe(message.key);
    });

    test("uses the default emoji when none is supplied", async () => {
        const sent = [];
        const message = {
            key: { id: "message-2", remoteJid: "chat@g.us" },
            reply: async () => {
                throw new Error("unexpected reply");
            },
        };

        await reactCommand(message, {
            sock: { sendMessage: async (...args) => sent.push(args) },
            args: [],
        });

        expect(sent[0][1].react.text).toBe("🥷🏽");
    });

    test("rejects multiple or non-emoji values", async () => {
        const replies = [];
        let sends = 0;
        const message = {
            key: { id: "message-3", remoteJid: "chat@g.us" },
            reply: async (text) => replies.push(text),
        };

        await reactCommand(message, {
            sock: { sendMessage: async () => sends++ },
            args: ["🔥", "💚"],
        });
        await reactCommand(message, {
            sock: { sendMessage: async () => sends++ },
            args: ["hello"],
        });

        expect(sends).toBe(0);
        expect(replies).toHaveLength(2);
        expect(replies[0]).toContain("رمزًا تعبيريًا واحدًا");
    });
});
