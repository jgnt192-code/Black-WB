import { afterEach, describe, expect, test } from "bun:test";
import last from "../src/plugins/owner/last.js";

const previousAllowedUsers = Bun.env.LAST_COMMAND_ALLOWED_USERS;

const makeMessage = (sender, isGroup = false) => {
    const replies = [];
    return {
        sender,
        isGroup,
        text: ".last",
        replies,
        reply: async (text) => replies.push(text),
    };
};

const sock = {
    decodeJid: (jid) => jid,
    groupMetadata: async () => ({
        subject: "مجموعة اختبار",
        participants: [
            { id: "member-1@s.whatsapp.net" },
            { id: "member-2@s.whatsapp.net" },
            { id: "member-3@s.whatsapp.net" },
        ],
    }),
    getChats: () => [
        {
            id: "group@g.us",
            subject: "مجموعة اختبار",
            conversationTimestamp: 20,
        },
        {
            id: "213000000000@s.whatsapp.net",
            name: "حساب تجريبي",
            conversationTimestamp: 10,
        },
    ],
};

afterEach(() => {
    if (previousAllowedUsers === undefined) {
        delete Bun.env.LAST_COMMAND_ALLOWED_USERS;
    } else {
        Bun.env.LAST_COMMAND_ALLOWED_USERS = previousAllowedUsers;
    }
});

describe("last command access", () => {
    test("allows the configured number to use last without making them a bot owner", async () => {
        Bun.env.LAST_COMMAND_ALLOWED_USERS = "+213 654 632 999";
        const m = makeMessage("213654632999@s.whatsapp.net");

        await last(m, { sock, isOwner: false });

        expect(m.replies).toHaveLength(1);
        expect(m.replies[0]).toContain("مجموعة اختبار");
        expect(m.replies[0]).toContain("الدردشة رقم 1: مجموعة اختبار");
        expect(m.replies[0]).toContain("الدردشة رقم 2: حساب تجريبي");
        expect(m.replies[0]).not.toContain("محادثة خاصة");
        expect(m.replies[0]).toContain("المجموعات: 1");
        expect(m.replies[0]).toContain("الأعضاء: 3");
        expect(last.owner).toBe(false);
    });

    test("keeps unapproved users from seeing the chat list", async () => {
        Bun.env.LAST_COMMAND_ALLOWED_USERS = "213654632999";
        const m = makeMessage("213600000000@s.whatsapp.net");

        await last(m, { sock, isOwner: false });

        expect(m.replies).toHaveLength(0);
    });

    test("still allows the bot owner and blocks use from group chats", async () => {
        Bun.env.LAST_COMMAND_ALLOWED_USERS = "";
        const ownerMessage = makeMessage("owner@s.whatsapp.net");
        await last(ownerMessage, { sock, isOwner: true });
        expect(ownerMessage.replies).toHaveLength(1);

        const groupMessage = makeMessage("213654632999@s.whatsapp.net", true);
        await last(groupMessage, { sock, isOwner: true });
        expect(groupMessage.replies).toHaveLength(0);
    });

    test("paginates the full chat list and displays contact names", async () => {
        Bun.env.LAST_COMMAND_ALLOWED_USERS = "213654632999";
        const chats = Array.from({ length: 35 }, (_, index) => ({
            id: `contact-${index}@s.whatsapp.net`,
            name: `Contact ${index}`,
            conversationTimestamp: index,
        }));
        const pagedSock = { ...sock, getChats: () => chats };
        const firstPage = makeMessage("213654632999@s.whatsapp.net");

        await last(firstPage, {
            sock: pagedSock,
            isOwner: false,
            usedPrefix: ".",
        });

        expect(firstPage.replies[0]).toContain("35");
        expect(firstPage.replies[0]).toContain("صفحة 1/2");
        expect(firstPage.replies[0]).toContain(".last 2");
        expect(firstPage.replies[0]).toContain("الدردشة رقم 1: Contact 34");
        expect(firstPage.replies[0]).not.toContain("Contact 4 —");

        const secondPage = makeMessage("213654632999@s.whatsapp.net");
        secondPage.text = ".last 2";
        await last(secondPage, {
            sock: pagedSock,
            isOwner: false,
            usedPrefix: ".",
        });

        expect(secondPage.replies[0]).toContain("صفحة 2/2");
        expect(secondPage.replies[0]).toContain("الدردشة رقم 31: Contact 4");
        expect(secondPage.replies[0]).toContain("الدردشة رقم 35: Contact 0");
        expect(secondPage.replies[0]).not.toContain(".last 3");
    });

    test("reports invalid page numbers and incomplete history sync", async () => {
        Bun.env.LAST_COMMAND_ALLOWED_USERS = "";
        const incompleteSock = {
            ...sock,
            getChatSyncStatus: () => ({ started: true, complete: false }),
        };
        const m = makeMessage("owner@s.whatsapp.net");
        m.text = ".last 9";
        await last(m, { sock: incompleteSock, isOwner: true });
        expect(m.replies[0]).toContain("رقم الصفحة غير موجود");

        m.text = ".last";
        await last(m, { sock: incompleteSock, isOwner: true });
        expect(m.replies[1]).toContain("ما زالت جارية");
    });
});
