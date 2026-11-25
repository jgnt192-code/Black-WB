import { afterEach, describe, expect, test } from "bun:test";
import addMe from "../src/plugins/owner/owner-addme.js";

const owner = "owner@s.whatsapp.net";
const bot = "bot@s.whatsapp.net";
const groupOne = "group-one@g.us";
const groupTwo = "group-two@g.us";

const makeMessage = (text = "", isGroup = false) => {
    const replies = [];
    let nextMessageId = 0;
    return {
        chat: isGroup ? groupOne : owner,
        sender: owner,
        isGroup,
        replies,
        reply: async (message) => {
            replies.push(message);
            nextMessageId += 1;
            return {
                key: { id: `sent-message-${nextMessageId}` },
                chat: isGroup ? groupOne : owner,
            };
        },
    };
};

const makeSocket = (overrides = {}) => ({
    user: { id: bot },
    decodeJid: (jid) => jid,
    getChats: () => [
        { id: groupOne, subject: "المجموعة الأولى", conversationTimestamp: 10 },
        { id: "friend@s.whatsapp.net", name: "محادثة خاصة", conversationTimestamp: 30 },
        { id: groupTwo, subject: "المجموعة الثانية", conversationTimestamp: 20 },
    ],
    groupMetadata: async () => ({
        participants: [{ id: bot, admin: "admin" }],
    }),
    groupParticipantsUpdate: async () => [{ status: "200", jid: owner }],
    ...overrides,
});

const runCommand = (m, sock, command, text = "") =>
    addMe(m, {
        sock,
        command,
        text,
        args: text ? text.split(/\s+/u) : [],
        usedPrefix: ".",
    });

afterEach(async () => {
    await addMe.cleanup();
});

describe("owner self-add command", () => {
    test("is owner-only and supports list and selection commands", () => {
        expect(addMe.owner).toBe(true);
        expect(addMe.silentUnauthorized).toBe(true);
        expect(addMe.command.test("اضفني")).toBe(true);
        expect(addMe.command.test("اضف")).toBe(true);
    });

    test("lists only recent groups and adds only the invoking owner", async () => {
        const m = makeMessage();
        const calls = [];
        const sock = makeSocket({
            groupParticipantsUpdate: async (...args) => {
                calls.push(args);
                return [{ status: "200", jid: owner }];
            },
        });

        await runCommand(m, sock, "اضفني");
        expect(m.replies[0]).toContain("1. المجموعة الثانية");
        expect(m.replies[0]).toContain("2. المجموعة الأولى");
        expect(m.replies[0]).not.toContain("محادثة خاصة");

        m.quoted = { id: "sent-message-1", chat: m.chat };
        await runCommand(m, sock, "اضف", "2");
        expect(calls).toEqual([[groupOne, [owner], "add"]]);
        expect(m.replies[1]).toContain("تمت إضافة حسابك");
    });

    test("requires a fresh list and validates the selected index", async () => {
        const m = makeMessage();
        const sock = makeSocket();

        await runCommand(m, sock, "اضف", "1");
        expect(m.replies[0]).toContain("اضفني أولًا");

        await runCommand(m, sock, "اضفني");
        m.quoted = { id: "sent-message-2", chat: m.chat };
        await runCommand(m, sock, "اضف", "99");
        expect(m.replies[2]).toContain("اختر رقمًا");
    });

    test("requires the bot to be a group admin and reports existing membership", async () => {
        const m = makeMessage();
        const calls = [];
        const sock = makeSocket({
            groupMetadata: async () => ({
                participants: [{ id: bot, admin: null }],
            }),
            groupParticipantsUpdate: async (...args) => calls.push(args),
        });

        await runCommand(m, sock, "اضفني");
        m.quoted = { id: "sent-message-1", chat: m.chat };
        await runCommand(m, sock, "اضف", "1");
        expect(calls).toHaveLength(0);
        expect(m.replies[1]).toContain("مشرفًا");

        await addMe.cleanup();
        const existingMessage = makeMessage();
        const existingSocket = makeSocket({
            groupMetadata: async () => ({
                participants: [
                    { id: bot, admin: "admin" },
                    { id: owner, admin: null },
                ],
            }),
            groupParticipantsUpdate: async (...args) => calls.push(args),
        });
        await runCommand(existingMessage, existingSocket, "اضفني");
        existingMessage.quoted = { id: "sent-message-1", chat: existingMessage.chat };
        await runCommand(existingMessage, existingSocket, "اضف", "1");
        expect(existingMessage.replies[1]).toContain("موجود بالفعل");
        expect(calls).toHaveLength(0);
    });

    test("only works in a private chat", async () => {
        const m = makeMessage("", true);
        await runCommand(m, makeSocket(), "اضفني");
        expect(m.replies[0]).toContain("محادثة خاصة");
    });
});
