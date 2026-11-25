/**
 * @file Black-Mahora bot core entry point and lifecycle manager
 * @module main
 * @description Main initialization file for Black-Mahora WhatsApp bot - handles
 * authentication, connection management, plugin loading, and graceful shutdown.
 * @license Apache-2.0
 * @author Naruya Izumi
 */

import "./config.js";
import { serialize } from "#core/message.js";
import { useSQLiteAuthState } from "#auth";
import { Browsers, fetchLatestBaileysVersion } from "baileys";
import { dirname, join } from "node:path";
import {
    loadPlugins,
    EventManager,
    cleanupReconnect,
    reloadAllPlugins,
    reloadSinglePlugin,
} from "#core/connection.js";
import { naruyaizumi } from "#core/socket.js";

const rawConsoleInfo = console.info.bind(console);
const rawConsoleWarn = console.warn.bind(console);

console.info = (...args) => {
    if (/^(?:Closing|Opening) session:$/.test(String(args[0] ?? ""))) {
        rawConsoleInfo("Signal session details redacted.");
        return;
    }

    rawConsoleInfo(...args);
};

console.warn = (...args) => {
    if (/^Session already closed\b/.test(String(args[0] ?? ""))) {
        rawConsoleWarn("Signal session details redacted.");
        return;
    }

    rawConsoleWarn(...args);
};

let auth = null;
let isDown = false;

function normalizePairingNumber(value) {
    const input = String(value || "")
        .trim()
        .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
    if (!input) return "";

    if (!/^\+?[\d\s().-]+$/.test(input)) {
        throw new Error("PAIRING_NUMBER must contain only a country code and phone number.");
    }

    let digits = input.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);

    if (!/^\d{10,15}$/.test(digits)) {
        throw new Error(
            "PAIRING_NUMBER must include the country code and contain 10–15 digits."
        );
    }

    return digits;
}

const logger = () => {
    const LVL = {
        fatal: 60,
        error: 50,
        warn: 40,
        info: 30,
        debug: 20,
        trace: 10,
    };

    const curLvl = LVL[Bun.env.BAILEYS_LOG_LEVEL?.toLowerCase() || "silent"];
    const should = (lvl) => LVL[lvl] >= curLvl;

    const fmt = (val) => {
        if (val === null) return "null";
        if (val === undefined) return "undefined";
        if (val instanceof Error) return val.message || val.toString();
        if (typeof val === "object") {
            return Bun.inspect(val, { colors: false, depth: 2 });
        }
        return String(val);
    };

    const fmtLog = (lvl, ...args) => {
        const time = new Date().toTimeString().slice(0, 5);
        const lvlName = lvl.toUpperCase();
        const fmtArgs = args.map((arg) => fmt(arg));

        let obj = null;
        let msg;

        if (args.length > 0 && typeof args[0] === "object" && args[0] !== null) {
            obj = args[0];
            msg = fmtArgs.slice(1).join(" ");
        } else {
            msg = fmtArgs.join(" ");
        }

        if (obj && Object.keys(obj).length > 0) {
            const lines = Object.entries(obj)
                .map(([k, v]) => `    ${k}: ${fmt(v)}`)
                .join("\n");
            return `[${time}] ${lvlName}: ${msg}\n${lines}`;
        }
        return `[${time}] ${lvlName}: ${msg}`;
    };

    return {
        level: "silent",
        fatal: (...args) => {
            if (should("fatal")) console.error(fmtLog("fatal", ...args));
        },
        error: (...args) => {
            if (should("error")) console.error(fmtLog("error", ...args));
        },
        warn: (...args) => {
            if (should("warn")) console.warn(fmtLog("warn", ...args));
        },
        info: (...args) => {
            if (should("info")) console.log(fmtLog("info", ...args));
        },
        debug: (...args) => {
            if (should("debug")) console.debug(fmtLog("debug", ...args));
        },
        trace: (...args) => {
            if (should("trace")) console.trace(fmtLog("trace", ...args));
        },
        child: () => logger(),
    };
};

async function pair(sock, phoneNumber) {
    try {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const code = await sock.requestPairingCode(phoneNumber);
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

        console.log("\n=== WhatsApp device linking ===");
        console.log(`WhatsApp pairing code: ${formattedCode}`);
        console.log("In WhatsApp: Linked devices > Link a device > Link with phone number.");
        console.log("Keep this code private.\n");
    } catch (e) {
        console.error(`WhatsApp pairing code could not be generated: ${e.message}`);
        global.logger.error({ error: e.message }, "Pair error");
    }
}

async function LIORA() {
    if (!global.config.primaryOwner) {
        throw new Error(
            "PRIMARY_OWNER must be configured with the bot owner's WhatsApp number or LID."
        );
    }

    const pairingNumber = normalizePairingNumber(global.config.pairingNumber);

    auth = useSQLiteAuthState();
    const { state, saveCreds } = auth;

    const { version: v } = await fetchLatestBaileysVersion();

    global.logger.info({ version: v.join(".") }, "Baileys version loaded");

    const opt = {
        version: v,
        logger: logger(),
        browser: Browsers.macOS("Safari"),
        auth: state,
        syncFullHistory: true,
    };

    global.sock = naruyaizumi(opt);
    global.sock.isInit = false;

    if (!state.creds.registered && pairingNumber) {
        await pair(global.sock, pairingNumber);
    }

    const evt = new EventManager();

    const hdl = await import("./handler.js");
    evt.setHandler(hdl);

    global.reloadHandler = await evt.createReloadHandler(opt, saveCreds);

    const file = Bun.fileURLToPath(import.meta.url);
    const src = dirname(file);
    const plugDir = join(src, "./plugins");

    await loadPlugins(plugDir);

    global.pluginFolder = plugDir;

    global.reloadAllPlugins = async () => {
        return reloadAllPlugins(plugDir);
    };

    global.reloadSinglePlugin = async (fp) => {
        return reloadSinglePlugin(fp, plugDir);
    };

    await global.reloadHandler();
    serialize();
}

async function shutdown(sig) {
    if (isDown) return;
    isDown = true;

    global.logger.info(`Shutdown (${sig})...`);

    try {
        if (!global.__reconnect) {
            global.__reconnect = {
                attempts: 0,
                lastAt: 0,
                cooldownUntil: 0,
                inflight: false,
                timer: null,
                keepAliveTimer: null,
            };
        }

        cleanupReconnect();

        if (auth && typeof auth._dispose === "function") {
            try {
                await Promise.race([
                    auth._dispose(),
                    new Promise((_, rej) =>
                        setTimeout(() => rej(new Error("Dispose timeout")), 5000)
                    ),
                ]);
                auth = null;
                global.logger.debug("Auth disposed");
            } catch (e) {
                global.logger.error({ error: e.message }, "Auth dispose error");
            }
        }

        global.logger.info("Shutdown ok");
    } catch (e) {
        global.logger.error({ error: e.message, stack: e.stack }, "Shutdown error");
    }
}

process.on("SIGTERM", async () => {
    await shutdown("SIGTERM");
    process.exit(0);
});

process.on("SIGINT", async () => {
    await shutdown("SIGINT");
    process.exit(0);
});

process.on("uncaughtException", async (e) => {
    global.logger.error({ error: e.message, stack: e.stack }, "Uncaught");
    await shutdown("uncaughtException");
    process.exit(1);
});

process.on("unhandledRejection", async (e) => {
    global.logger.error({ error: e?.message, stack: e?.stack }, "Unhandled");
    await shutdown("unhandledRejection");
    process.exit(1);
});

LIORA().catch(async (e) => {
    global.logger.fatal({ error: e.message, stack: e.stack }, "Fatal");
    await shutdown("fatal");
    process.exit(1);
});