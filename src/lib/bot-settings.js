/**
 * Persistent settings for opt-in bot automations.
 * @license Apache-2.0
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SETTINGS_PATH = fileURLToPath(
    new URL("../database/bot-settings.json", import.meta.url)
);
const DEFAULTS = {
    botOwners: [],
    autoreact: false,
    reaction: "💚",
    autotype: false,
    autorecord: false,
    statuslike: false,
    online: false,
    welcomeGroups: {},
};

let cache;
let writeQueue = Promise.resolve();

async function readSettings() {
    if (cache) return cache;
    try {
        const data = JSON.parse(await readFile(SETTINGS_PATH, "utf8"));
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Bot settings file must contain an object");
        }
        cache = {
            ...DEFAULTS,
            ...data,
            botOwners: Array.isArray(data.botOwners)
                ? data.botOwners.filter((owner) => typeof owner === "string" && owner.trim())
                : [],
            welcomeGroups: {
                ...DEFAULTS.welcomeGroups,
                ...(data.welcomeGroups || {}),
            },
        };
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        cache = structuredClone(DEFAULTS);
    }
    return cache;
}

export async function getBotSettings() {
    return structuredClone(await readSettings());
}

export function updateBotSettings(update) {
    const operation = writeQueue.then(async () => {
        const current = structuredClone(await readSettings());
        const next = update(current);
        if (!next || typeof next !== "object" || Array.isArray(next)) {
            throw new Error("Bot settings update must return an object");
        }

        await mkdir(dirname(SETTINGS_PATH), { recursive: true });
        const tempPath = `${SETTINGS_PATH}.tmp`;
        await writeFile(tempPath, JSON.stringify(next, null, 2), {
            encoding: "utf8",
            mode: 0o600,
        });
        await rename(tempPath, SETTINGS_PATH);
        cache = next;
        return structuredClone(cache);
    });
    writeQueue = operation.catch(() => undefined);
    return operation;
}
