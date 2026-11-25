import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { loadPlugins } from "../src/lib/core/connection.js";

async function listPluginFiles(directory, root = directory) {
    const files = [];

    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const filepath = join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...await listPluginFiles(filepath, root));
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
            files.push(relative(root, filepath).replace(/\\/g, "/"));
        }
    }

    return files.sort();
}

describe("plugin loader", () => {
    test("imports every registered command without opening WhatsApp", async () => {
        const original = {
            sock: global.sock,
            plugins: global.plugins,
            logger: global.logger,
        };
        const listeners = new Map();
        const errors = [];
        global.sock = {
            ev: {
                on(event, listener) {
                    const registered = listeners.get(event) || [];
                    registered.push(listener);
                    listeners.set(event, registered);
                },
                off(event, listener) {
                    const registered = listeners.get(event);
                    if (!registered) return;
                    const index = registered.lastIndexOf(listener);
                    if (index !== -1) registered.splice(index, 1);
                },
                listenerCount(event) {
                    return listeners.get(event)?.length || 0;
                },
            },
        };
        global.plugins = {};
        global.logger = {
            info() {},
            error(...args) {
                errors.push(args);
            },
        };

        try {
            const pluginDirectory = join(process.cwd(), "src", "plugins");
            const expectedPlugins = await listPluginFiles(pluginDirectory);
            const result = await loadPlugins(pluginDirectory);

            expect(result.failed).toBe(0);
            expect(result.success).toBe(expectedPlugins.length);
            expect(errors).toHaveLength(0);
            expect(Object.keys(global.plugins).sort()).toEqual(expectedPlugins);
            expect(Object.keys(global.plugins)).toContain("ai/ai-openai.js");
            expect(Object.keys(global.plugins)).toContain("games/games.js");
            expect(Object.keys(global.plugins)).toContain("owner/owner-addme.js");
            expect(Object.keys(global.plugins)).toContain("info/info-owner.js");
            for (const [filename, plugin] of Object.entries(global.plugins)) {
                if (filename === "games/anime-characters.js") {
                    expect(plugin.ADDITIONAL_ANIME_PUZZLES).toBeInstanceOf(Array);
                    continue;
                }

                expect(typeof plugin).toBe("function");
                expect(plugin.command).toBeInstanceOf(RegExp);
                expect(Array.isArray(plugin.help)).toBe(true);
            }

            expect(global.sock.ev.listenerCount("group-participants.update")).toBe(1);

            const reloaded = await loadPlugins(pluginDirectory);
            expect(reloaded.failed).toBe(0);
            expect(reloaded.success).toBe(expectedPlugins.length);
            expect(global.sock.ev.listenerCount("group-participants.update")).toBe(1);

            await global.plugins["owner/owner-automation.js"].cleanup();
            expect(global.sock.ev.listenerCount("group-participants.update")).toBe(0);
        } finally {
            for (const plugin of Object.values(global.plugins)) {
                await plugin.cleanup?.();
            }
            global.sock = original.sock;
            global.plugins = original.plugins;
            global.logger = original.logger;
        }
    });
});
