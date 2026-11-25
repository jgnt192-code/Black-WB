import { afterEach, describe, expect, test } from "bun:test";
import aiCommand from "../src/plugins/ai/ai-openai.js";

const originalFetch = globalThis.fetch;
const originalApiKey = Bun.env.OPENAI_API_KEY;
const originalLoading = global.loading;

afterEach(() => {
    globalThis.fetch = originalFetch;
    global.loading = originalLoading;
    if (originalApiKey === undefined) {
        delete Bun.env.OPENAI_API_KEY;
    } else {
        Bun.env.OPENAI_API_KEY = originalApiKey;
    }
});

describe("OpenAI command", () => {
    test("sends dialect and owner-style instructions without a live API call", async () => {
        Bun.env.OPENAI_API_KEY = "test-only-key";
        global.loading = async () => {};

        let requestBody;
        let authorization;
        const sent = [];
        globalThis.fetch = async (_url, options) => {
            requestBody = JSON.parse(options.body);
            authorization = options.headers.Authorization;
            return new Response(JSON.stringify({ output_text: "أهلاً بيك" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        };

        await aiCommand(
            {
                chat: "chat@g.us",
                sender: "owner@test",
                reply: async (text) => sent.push(text),
            },
            {
                sock: {
                    sendMessage: async (...args) => sent.push(args),
                },
                args: ["قول", "أهلاً"],
                usedPrefix: ".",
                command: "ai",
                isOwner: true,
            }
        );

        expect(requestBody.instructions).toContain("الجزائرية");
        expect(requestBody.instructions).toContain("الليبية");
        expect(requestBody.instructions).toContain("العراقية");
        expect(requestBody.instructions).toContain("مالك البوت الموثّق");
        expect(requestBody.store).toBe(false);
        expect(authorization).toBe("Bearer test-only-key");
        expect(sent[0][1].text).toContain("أهلاً بيك");
    });

    test("reports a missing key without making a request", async () => {
        delete Bun.env.OPENAI_API_KEY;
        global.loading = async () => {};

        let called = false;
        globalThis.fetch = async () => {
            called = true;
            throw new Error("fetch should not run without a key");
        };
        const replies = [];

        await aiCommand(
            {
                chat: "chat@g.us",
                reply: async (text) => replies.push(text),
            },
            {
                sock: { sendMessage: async () => {} },
                args: ["مرحبا"],
                usedPrefix: ".",
                command: "ai",
                isOwner: true,
            }
        );

        expect(called).toBe(false);
        expect(replies[0]).toContain("OPENAI_API_KEY");
    });

    test("allows non-owners and gives them the regular-user instructions", async () => {
        Bun.env.OPENAI_API_KEY = "test-only-key";
        global.loading = async () => {};

        let requestBody;
        globalThis.fetch = async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return new Response(JSON.stringify({ output_text: "أهلاً" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        };

        await aiCommand(
            {
                chat: "chat@g.us",
                sender: "member@test",
                reply: async () => {},
            },
            {
                sock: { sendMessage: async () => {} },
                args: ["مرحبا"],
                usedPrefix: ".",
                command: "ai",
                isOwner: false,
            }
        );

        expect(requestBody.instructions).toContain("لا تفترض أن المرسل هو مالك البوت");
        expect(aiCommand.owner).not.toBe(true);
    });

    test("limits every user to ten requests per hour with a cooldown", async () => {
        Bun.env.OPENAI_API_KEY = "test-only-key";
        global.loading = async () => {};

        const originalNow = Date.now;
        let now = 1_800_000_000_000;
        Date.now = () => now;
        let fetchCalls = 0;
        const replies = [];
        globalThis.fetch = async () => {
            fetchCalls++;
            return new Response(JSON.stringify({ output_text: "تم" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        };

        try {
            for (let i = 0; i < 10; i++) {
                await aiCommand(
                    {
                        chat: "chat@g.us",
                        sender: "limited-user@test",
                        reply: async (text) => replies.push(text),
                    },
                    {
                        sock: { sendMessage: async () => {} },
                        args: ["مرحبا"],
                        usedPrefix: ".",
                        command: "ai",
                        isOwner: false,
                    }
                );
                now += 15_001;
            }

            await aiCommand(
                {
                    chat: "chat@g.us",
                    sender: "limited-user@test",
                    reply: async (text) => replies.push(text),
                },
                {
                    sock: { sendMessage: async () => {} },
                    args: ["طلب إضافي"],
                    usedPrefix: ".",
                    command: "ai",
                    isOwner: false,
                }
            );
        } finally {
            Date.now = originalNow;
        }

        expect(fetchCalls).toBe(10);
        expect(replies.at(-1)).toContain("10 طلبات في الساعة");
    });
});

test("owner and group-id commands are registered", () => {
    expect(aiCommand.owner).not.toBe(true);
    expect(aiCommand.command.test("مساعد")).toBe(true);
});
