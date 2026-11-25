/**
 * @file File upload to various servers command handler
 * @module plugins/tools/upload
 * @license Apache-2.0
 * @author Naruya Izumi
 */

import {
    uploader1,
    uploader2,
    uploader3,
    uploader4,
    uploader5,
    uploader6,
    uploader7,
    uploader,
} from "#lib/uploader.js";

const servers = {
    1: { name: "Catbox.moe", fn: uploader1 },
    2: { name: "Uguu.se", fn: uploader2 },
    3: { name: "Qu.ax", fn: uploader3 },
    4: { name: "Put.icu", fn: uploader4 },
    5: { name: "Tmpfiles.org", fn: uploader5 },
    6: { name: "Videy", fn: uploader6 },
    7: { name: "GoFile", fn: uploader7 },
};

let handler = async (m, { sock, args, usedPrefix, command }) => {
    const q = m.quoted?.mimetype ? m.quoted : m;
    const mime = (q.msg || q).mimetype || q.mediaType || "";
    
    if (!args[0]) {
        if (!mime) {
            const list = `*خوادم رفع الملفات*

1. Catbox.moe
2. Uguu.se
3. Qu.ax
4. Put.icu
5. Tmpfiles.org
6. Videy (للفيديو فقط)
7. GoFile (للصور فقط)

مثال: ${usedPrefix + command} 1`;
            return m.reply(list);
        }
        
        await global.loading(m, sock);
        
        let buffer;
        try {
            buffer = await q.download?.();
            if (!buffer) throw new Error("تعذّر تنزيل الوسائط.");
        } catch {
            return m.reply("تعذّر تنزيل الوسائط.");
        }
        
        const sizeKB = (buffer.length / 1024).toFixed(2);
        const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
        const size = buffer.length > 1024 * 1024 ? `${sizeMB} MB` :
            `${sizeKB} KB`;
        
        try {
            const res = await uploader(buffer);
            if (res?.success) {
                return sock.client(
                    m.chat,
                    {
                        text: `تم الرفع\nالخادم: ${res.provider}\nالحجم: ${size}`,
                        interactiveButtons: [
                        {
                            name: "cta_copy",
                            buttonParamsJson: JSON
                                .stringify({
                                    display_text: "نسخ الرابط",
                                    copy_code: res.url,
                                }),
                        }, ],
                    }, { quoted: m }
                );
            }
            return m.reply(`تعذّر رفع الملف.\nالحجم: ${size}`);
        } catch {
            return m.reply(`حدث خطأ أثناء الرفع.\nالحجم: ${size}`);
        }
    }
    
    const num = args[0].toString().trim().match(/\d+/)?.[0];
    if (!num || !servers[num]) return m.reply("رقم الخادم غير صحيح. اختر رقمًا من 1 إلى 7.");
    
    if (!mime) {
        return m.reply("أرفق الوسائط أو رد على رسالتها.");
    }
    
    let buffer;
    try {
        buffer = await q.download?.();
            if (!buffer) throw new Error("تعذّر تنزيل الوسائط.");
    } catch {
            return m.reply("تعذّر تنزيل الوسائط.");
    }
    
    const sizeKB = (buffer.length / 1024).toFixed(2);
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    const size = buffer.length > 1024 * 1024 ? `${sizeMB} MB` :
        `${sizeKB} KB`;
    
    const srv = servers[num];
    
    try {
        let result = await srv.fn(buffer);
        let caption = "";
        let url = "";
        
        if (!result) {
            await m.reply(`تعذّر الرفع عبر ${srv.name}، جارٍ تجربة خادم بديل.`);
            result = await uploader(buffer);
            if (result?.success) {
                caption =
                    `تم الرفع\nالخادم الأساسي: ${srv.name} (تعذّر الاتصال)\nالخادم البديل: ${result.provider}\nالحجم: ${size}`;
                url = result.url;
            }
        } else if (result.success) {
            caption =
                `تم الرفع\nالخادم: ${result.provider}\nالحجم: ${size}`;
            url = result.url;
        } else if (typeof result === "string") {
            caption = `تم الرفع\nالخادم: ${srv.name}\nالحجم: ${size}`;
            url = result;
        } else {
            return m.reply(`تعذّر رفع الملف.\nالحجم: ${size}`);
        }
        
        return sock.client(
            m.chat,
            {
                text: caption,
                interactiveButtons: [
                {
                    name: "cta_copy",
                    buttonParamsJson: JSON.stringify({
                    display_text: "نسخ الرابط",
                        copy_code: url,
                    }),
                }, ],
            }, { quoted: m }
        );
    } catch {
        return m.reply(`تعذّر رفع الملف.\nالحجم: ${size}`);
    } finally {
        await global.loading(m, sock, true);
    }
};

handler.help = ["upload", "url", "tourl", "رفع"];
handler.tags = ["tools"];
handler.command = /^(tourl|url|upload|رفع)$/iu;

export default handler;