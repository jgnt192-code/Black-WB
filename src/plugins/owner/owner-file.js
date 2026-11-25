/**
 * @file File manager command handler
 * @module plugins/owner/file
 * @license Apache-2.0
 * @author Naruya Izumi
 */

import { readdir, mkdir } from "node:fs/promises";
import { join, resolve, extname, basename, dirname, relative } from "node:path";

let handler = async (m, { sock, args, usedPrefix, command }) => {
    if (!args.length) return m.reply(`*إدارة الملفات*

*الاستخدام:*
- ${usedPrefix + command} s <مسار> — حفظ ملف مرفق
- ${usedPrefix + command} d <مسار> — حذف ملف
- ${usedPrefix + command} g <مسار> — إرسال ملف
- ${usedPrefix + command} r — إعادة تحميل الإضافات

*أمثلة:*
- ${usedPrefix + command} s src lib
- ${usedPrefix + command} d src lib core.js
- ${usedPrefix + command} g src plugins info info-ping.js`);

    const mode = args[0].toLowerCase();

    try {
        switch (mode) {
            case "s": {
                const pth = args.slice(1);
                let t = pth.length ? join(process.cwd(), ...pth) : process.cwd();
                t = resolve(t);

                if (!m.quoted) {
                    const items = await readdir(t, { withFileTypes: true }).catch(() => null);
                    if (!items) return m.reply(`المجلد غير موجود: ${t}`);

                    const list =
                        items
                            .sort((a, b) =>
                                a.isDirectory() === b.isDirectory()
                                    ? a.name.localeCompare(b.name)
                                    : a.isDirectory()
                                      ? -1
                                      : 1
                            )
                            .map(i => `${i.isDirectory() ? "مجلد" : "ملف"}: ${i.name}${i.isDirectory() ? "/" : ""}`)
                            .join("\n") || "(empty)";

                    return m.reply(`المسار: ${t}

${list}`);
                }

                const q = m.quoted;
                const mime = q.mimetype || q.mediaType || "";
                if (!q?.download || !/^(image|video|audio|application)/.test(mime)) {
                    return m.reply("أرفق ملفًا أو مستندًا مع الأمر.");
                }

                const buf = await q.download().catch(() => null);
                if (!buf?.length) return m.reply("تعذّر تنزيل الملف المرفق.");

                const ext = mime.split("/")[1] || extname(q.fileName || "").slice(1) || "bin";
                const name = q.fileName ? basename(q.fileName) : `file-${Date.now()}.${ext}`;
                const fp = resolve(t, name);

                await mkdir(dirname(fp), { recursive: true });
                await Bun.write(fp, buf);

                return m.reply(`تم حفظ الملف: ${relative(process.cwd(), fp)}`);
            }

            case "d": {
                if (args.length < 2) {
                    return m.reply(`اكتب مسار الملف.
مثال: ${usedPrefix + command} d plugins owner file`);
                }

                let t = join(...args.slice(1));
                if (!extname(t)) t += ".js";

                const fp = resolve(process.cwd(), t);
                const f = Bun.file(fp);

                if (!(await f.exists())) {
                    return m.reply(`الملف غير موجود: ${fp}`);
                }

                await f.delete();
                return m.reply("تم حذف الملف.");
            }

            case "g": {
                if (args.length < 2) {
                    return m.reply(`اكتب مسار الملف.
مثال: ${usedPrefix + command} g plugins owner file`);
                }

                let t = join(...args.slice(1));
                if (!extname(t)) t += ".js";

                const fp = join(process.cwd(), t);
                const buf = Buffer.from(await Bun.file(fp).arrayBuffer());
                const name = basename(t);

                await sock.sendMessage(
                    m.chat,
                    {
                        document: buf,
                        fileName: name,
                        mimetype: "application/javascript"
                    },
                    { quoted: m }
                );
                break;
            }

            case "r": {
                await global.reloadAllPlugins();
                await global.reloadHandler();
                return m.reply("تمت إعادة تحميل الإضافات.");
            }

            default:
                return m.reply(`*إدارة الملفات*

*الاستخدام:*
- ${usedPrefix + command} s <مسار>
- ${usedPrefix + command} d <مسار>
- ${usedPrefix + command} g <مسار>
- ${usedPrefix + command} r`);
        }
    } catch (e) {
        global.logger?.error(e, "File command failed");
        return m.reply("تعذّر تنفيذ أمر الملفات.");
    }
};

handler.help = ["file", "f", "ملفات"];
handler.tags = ["owner"];
handler.command = /^(file|f|ملفات)$/iu;
handler.owner = true;
handler.primaryOwner = true;
handler.silentUnauthorized = true;

export default handler;