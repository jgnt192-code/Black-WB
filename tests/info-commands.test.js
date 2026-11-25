import { describe, expect, test } from "bun:test";
import getid from "../src/plugins/info/info-getid.js";
import owner from "../src/plugins/info/info-owner.js";

describe("owner and group information commands", () => {
    test("gcid is an alias for the group ID command", () => {
        expect(getid.command.test("gcid")).toBe(true);
        expect(getid.group).toBe(true);
    });

    test("owner sends a contact built from configured values", async () => {
        const originalConfig = global.config;
        const sent = [];
        global.config = {
            owner: ["+218912345678@s.whatsapp.net"],
            author: "مالك, البوت",
        };

        try {
            await owner(
                {
                    chat: "chat@g.us",
                    reply: async () => {
                        throw new Error("unexpected reply");
                    },
                },
                {
                    sock: {
                        sendMessage: async (...args) => sent.push(args),
                    },
                }
            );

            const vcard = sent[0][1].contacts.contacts[0].vcard;
            expect(vcard).toContain("FN:مالك\\, البوت");
            expect(vcard).toContain("waid=218912345678:+218912345678");
        } finally {
            global.config = originalConfig;
        }
    });

    test("owner explains when no number is configured", async () => {
        const originalConfig = global.config;
        const replies = [];
        global.config = { owner: [], author: "Bot" };

        try {
            await owner(
                {
                    chat: "chat@g.us",
                    reply: async (text) => replies.push(text),
                },
                {
                    sock: { sendMessage: async () => {} },
                }
            );

            expect(replies[0]).toContain("غير مضبوط");
        } finally {
            global.config = originalConfig;
        }
    });
});
