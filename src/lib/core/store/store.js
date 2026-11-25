/**
 * @file Pure in-memory store untuk WhatsApp data synchronization
 * @module store
 * @description Ultra-lightweight memory store dengan optimal performance
 * @license Apache-2.0
 * @author Naruya Izumi
 */

import { BufferJSON } from "baileys";

const TTL = {
    CHAT: 604800000,
    GROUP: 604800000,
};

const MAX_ENTRIES = 5000;
const CLEANUP_INTERVAL = 1800000;
const EVICT_PERCENTAGE = 0.2;
const CHAT_SUMMARY_FIELDS = [
    "name",
    "notify",
    "verifiedName",
    "username",
    "displayName",
    "subject",
    "conversationTimestamp",
    "unreadCount",
    "archived",
    "pinned",
    "ephemeralDuration",
    "isChats",
];
const chatIndex = new Map();

const definedEntries = (value) =>
    Object.entries(value || {}).filter(([, entry]) => entry !== undefined);

const mergeDefined = (current, update) => ({
    ...current,
    ...Object.fromEntries(definedEntries(update)),
});

function rememberChat(chat) {
    const id = chat?.id;
    if (typeof id !== "string" || !id || id === "status@broadcast") return;

    const summary = { id };
    for (const field of CHAT_SUMMARY_FIELDS) {
        if (chat[field] !== undefined) summary[field] = chat[field];
    }

    chatIndex.set(id, mergeDefined(chatIndex.get(id) || { id }, summary));
}

class MemoryStore {
    constructor() {
        this.data = new Map();
        this.lastAccess = new Map();
        this.expireAt = new Map();
        
        setInterval(() => this._cleanup(), CLEANUP_INTERVAL);
        setTimeout(() => this._cleanup(), 60000);
    }

    set(key, value, ttl = TTL.CHAT) {
        if (!this.data.has(key) && this.data.size >= MAX_ENTRIES) {
            this._evictLRU();
        }

        const now = Date.now();
        
        this.data.set(key, JSON.stringify(value, BufferJSON.replacer));
        this.lastAccess.set(key, now);
        
        if (ttl > 0) {
            this.expireAt.set(key, now + ttl);
        } else {
            this.expireAt.delete(key);
        }
    }

    get(key) {
        const value = this.data.get(key);
        if (!value) return null;

        const expire = this.expireAt.get(key);
        if (expire && Date.now() > expire) {
            this._delete(key);
            return null;
        }

        this.lastAccess.set(key, Date.now());
        
        return JSON.parse(value, BufferJSON.reviver);
    }

    getAllByPrefix(prefix) {
        const values = [];

        for (const key of this.data.keys()) {
            if (!key.startsWith(prefix)) continue;

            const value = this.get(key);
            if (value) values.push(value);
        }

        return values;
    }

    _delete(key) {
        this.data.delete(key);
        this.lastAccess.delete(key);
        this.expireAt.delete(key);
    }

    delete(key) {
        this._delete(key);
    }

    _evictLRU() {
        const toEvict = Math.floor(MAX_ENTRIES * EVICT_PERCENTAGE);
        
        const entries = [...this.lastAccess.entries()]
            .sort((a, b) => a[1] - b[1])
            .slice(0, toEvict);

        for (const [key] of entries) {
            this._delete(key);
        }
    }

    _cleanup() {
        const now = Date.now();
        const toDelete = [];

        for (const [key, expire] of this.expireAt.entries()) {
            if (now > expire) {
                toDelete.push(key);
            }
        }

        for (const key of toDelete) {
            this._delete(key);
        }
    }
}

const store = new MemoryStore();

const CHAT_KEY = (jid) => `c:${jid}`;

export default function bind(sock) {
    sock.getChat = (jid) => store.get(CHAT_KEY(jid));
    sock.getChats = () =>
        [...chatIndex.values()].map((summary) =>
            mergeDefined(summary, store.get(CHAT_KEY(summary.id)))
        );
    let historySync = { started: false, complete: false, progress: null };
    sock.getChatSyncStatus = () => ({ ...historySync });

    const setChat = (jid, data) => {
        const id = sock.decodeJid?.(jid) || jid;
        if (typeof id !== "string" || !id) return;

        const existing = store.get(CHAT_KEY(id)) || chatIndex.get(id) || { id };
        const chat = mergeDefined(existing, { ...data, id });
        const isGroup = id.endsWith("@g.us");
        store.set(CHAT_KEY(id), chat, isGroup ? TTL.GROUP : TTL.CHAT);
        rememberChat(chat);
        return chat;
    };
    sock.setChat = setChat;

    const fetchGroup = (id) => {
        if (typeof sock.groupMetadata !== "function") return;
        sock.groupMetadata(id)
            .then(meta => {
                if (!meta) return;
                
                const chat = sock.getChat(id) || { id };
                chat.subject = meta.subject;
                chat.metadata = meta;
                setChat(id, chat);
            })
            .catch(() => {});
    };

    const processChat = (chat) => {
        if (!chat?.id) return;
        const id = sock.decodeJid(chat.id);
        if (!id || id === "status@broadcast") return;

        const isGroup = id.endsWith("@g.us");
        const existing = sock.getChat(id) || { id };
        setChat(id, {
            ...existing,
            ...chat,
            id,
            conversationTimestamp:
                chat.conversationTimestamp ?? existing.conversationTimestamp,
            unreadCount: chat.unreadCount ?? existing.unreadCount ?? 0,
            archived: chat.archived ?? existing.archived ?? false,
            pinned: chat.pinned ?? existing.pinned ?? 0,
            ...(isGroup && {
                subject: chat.subject || chat.name || existing.subject,
            }),
        });

        if (isGroup) fetchGroup(id);
    };

    const processChats = (chats) => {
        if (!Array.isArray(chats)) return;
        if (chats.length) historySync.started = true;
        chats.forEach(processChat);
    };

    sock.ev.on(
        "messaging-history.set",
        ({ chats, contacts, isLatest, progress } = {}) => {
            historySync = {
                started: true,
                complete: historySync.complete || isLatest === true,
                progress: Number.isFinite(Number(progress)) ? Number(progress) : null,
            };
            processChats(chats);
            processContacts(contacts);
        }
    );

    sock.ev.on("chats.set", ({ chats } = {}) => {
        processChats(chats);
    });

    sock.ev.on("chats.upsert", (chats) => {
        if (!Array.isArray(chats)) return;
        if (chats.length) historySync.started = true;
        for (const chat of chats) {
            const id = sock.decodeJid(chat.id);
            if (!id || id === "status@broadcast") continue;

            const existing = sock.getChat(id) || { id };
            setChat(id, { ...chat, ...existing, ...chat, id });

            if (id.endsWith("@g.us") && !existing.metadata) {
                fetchGroup(id);
            }
        }
    });

    sock.ev.on("chats.update", (updates) => {
        if (!Array.isArray(updates)) return;
        for (const update of updates) {
            const id = sock.decodeJid(update?.id);
            if (!id || id === "status@broadcast") continue;
            const existing = sock.getChat(id) || { id };
            setChat(id, { ...existing, ...update, id });
        }
    });

    sock.ev.on("chats.delete", (ids) => {
        if (!Array.isArray(ids)) return;
        for (const rawId of ids) {
            const id = sock.decodeJid(
                typeof rawId === "string" ? rawId : rawId?.id
            );
            if (!id) continue;
            chatIndex.delete(id);
            store.delete(CHAT_KEY(id));
        }
    });

    const processContacts = (contacts) => {
        if (!Array.isArray(contacts)) return;
        for (const contact of contacts) {
            const id = sock.decodeJid(contact?.id);
            if (!id || id === "status@broadcast") continue;
            const existing = sock.getChat(id) || chatIndex.get(id);
            if (!existing) continue;
            setChat(id, { ...existing, ...contact, id });
        }
    };

    sock.ev.on("contacts.upsert", processContacts);
    sock.ev.on("contacts.update", processContacts);

    sock.ev.on("groups.update", (updates) => {
        if (!Array.isArray(updates)) return;
        for (const update of updates) {
            const id = sock.decodeJid(update.id);
            if (!id) continue;

            const chat = sock.getChat(id);
            if (chat) {
                setChat(id, { ...chat, ...update, id });
            }
        }
    });

    sock.ev.on("group-participants.update", ({ id }) => {
        id = sock.decodeJid(id);
        if (id && id !== "status@broadcast") fetchGroup(id);
    });
}