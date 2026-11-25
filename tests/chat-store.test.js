import { describe, expect, test } from "bun:test";
import bindStore from "../src/lib/core/store/store.js";

describe("chat store", () => {
    const makeSocket = () => {
        const handlers = new Map();
        const sock = {
            ev: {
                on(event, handler) {
                    handlers.set(event, handler);
                },
            },
            decodeJid: (jid) => jid,
        };
        return {
            sock,
            emit(event, data) {
                handlers.get(event)?.(data);
            },
        };
    };

    test("exposes setChat so socket message processing can persist metadata", () => {
        const { sock } = makeSocket();
        bindStore(sock);

        const chat = {
            id: "12345@g.us",
            metadata: { participants: [{ id: "member@lid", admin: "admin" }] },
        };
        sock.setChat(chat.id, chat);

        expect(sock.getChat(chat.id)).toEqual(chat);
    });

    test("keeps a complete chat index beyond the cache eviction limit", () => {
        const { sock } = makeSocket();
        bindStore(sock);

        for (let index = 0; index < 5010; index++) {
            const id = `chat-${index}@s.whatsapp.net`;
            sock.setChat(id, {
                id,
                name: `Contact ${index}`,
                conversationTimestamp: index,
            });
        }

        const chats = sock.getChats();
        expect(chats.some((chat) => chat.id === "chat-0@s.whatsapp.net")).toBe(true);
        expect(chats.some((chat) => chat.id === "chat-5009@s.whatsapp.net")).toBe(true);
    });

    test("merges partial chat updates, remembers contact names, and removes deleted chats", () => {
        const { sock, emit } = makeSocket();
        bindStore(sock);

        emit("messaging-history.set", {
            chats: [
                {
                    id: "12345@g.us",
                    name: "Old group name",
                    conversationTimestamp: 100,
                },
                {
                    id: "friend@s.whatsapp.net",
                    conversationTimestamp: 90,
                },
            ],
            contacts: [
                {
                    id: "friend@s.whatsapp.net",
                    notify: "Friend",
                    name: "Friend Name",
                },
            ],
            isLatest: false,
            progress: 25,
        });
        emit("chats.update", [{ id: "12345@g.us", subject: "Updated group" }]);

        expect(sock.getChat("12345@g.us").conversationTimestamp).toBe(100);
        expect(sock.getChats().find((chat) => chat.id === "12345@g.us").subject).toBe(
            "Updated group"
        );
        expect(
            sock.getChats().find((chat) => chat.id === "friend@s.whatsapp.net").name
        ).toBe("Friend Name");
        expect(sock.getChatSyncStatus()).toEqual({
            started: true,
            complete: false,
            progress: 25,
        });

        emit("messaging-history.set", { chats: [], isLatest: true, progress: 100 });
        expect(sock.getChatSyncStatus().complete).toBe(true);
        emit("chats.delete", ["12345@g.us"]);
        expect(sock.getChats().some((chat) => chat.id === "12345@g.us")).toBe(false);
    });
});
