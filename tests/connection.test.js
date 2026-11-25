import { describe, expect, test } from "bun:test";
import { handleDisconnect } from "../src/lib/core/connection.js";

describe("WhatsApp connection recovery", () => {
    test("stops retrying when another connection replaces this session", async () => {
        const original = {
            reconnect: global.__reconnect,
            timestamp: global.timestamp,
            logger: global.logger,
        };
        const errors = [];
        global.__reconnect = {
            attempts: 0,
            lastAt: 0,
            cooldownUntil: 0,
            inflight: false,
            timer: null,
            keepAliveTimer: null,
        };
        global.timestamp = {};
        global.logger = {
            warn() {},
            error(message) {
                errors.push(message);
            },
        };

        try {
            await handleDisconnect({
                lastDisconnect: { error: { output: { statusCode: 440 } } },
                connection: "close",
            });

            expect(global.__reconnect.timer).toBeNull();
            expect(errors).toContain(
                "WhatsApp session was replaced by another connection. Close the other running bot session, then restart this one."
            );
        } finally {
            if (global.__reconnect?.timer) clearTimeout(global.__reconnect.timer);
            if (global.__reconnect?.keepAliveTimer) clearInterval(global.__reconnect.keepAliveTimer);
            global.__reconnect = original.reconnect;
            global.timestamp = original.timestamp;
            global.logger = original.logger;
        }
    });
});
