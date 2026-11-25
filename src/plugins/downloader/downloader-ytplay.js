/**
 * @file YouTube downloader and search
 * @module plugins/downloader/play
 * @license Apache-2.0
 * @author Naruya Izumi
 */

const YT_REGEX = /^(https?:\/\/)?((www|m|music)\.)?(youtube(-nocookie)?\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+(\S+)?$/i;

const extractUrl = (text) => {
    if (!text) return null;
    const match = text.match(YT_REGEX);
    return match ? match[0] : null;
};

let handler = async (m, { sock, args, usedPrefix, command }) => {
    let raw = args.join(" ").trim();
    if (command === "بحث") raw = `s ${raw}`.trim();
    if (command === "فيديو") raw = `v ${raw}`.trim();

    if (!raw && m.quoted?.text) {
        raw = m.quoted.text.trim();
    }

    if (!raw) {
        return m.reply(
            `*تنزيل وبحث YouTube*\n\n` +
            `*الاستخدام:*\n` +
            `- ${usedPrefix + command} <كلمات البحث> — البحث وتشغيل الصوت\n` +
            `- ${usedPrefix + command} <رابط> — تنزيل الصوت\n` +
            `- ${usedPrefix + command} فيديو <رابط> — تنزيل الفيديو\n` +
            `- ${usedPrefix + command} بحث <كلمات> — عرض نتائج البحث\n\n` +
            `يمكنك أيضًا الرد على رابط YouTube.`
        );
    }

    if (m.quoted?.text) {
        const qUrl = extractUrl(m.quoted.text);
        if (qUrl && !extractUrl(raw)) {
            if (/^v$/i.test(raw)) {
                raw = `v ${qUrl}`;
            } else if (!raw.match(/^[vs]\s/i)) {
                raw = qUrl;
            }
        }
    }

    await global.loading(m, sock);

    try {
        // .play v <url> → download MP4 (pake API ytmp4)
        if (/^v\s+/i.test(raw)) {
            const url = raw.replace(/^v\s+/i, '').trim();
            const ytUrl = extractUrl(url);
            if (!ytUrl) return m.reply("رابط YouTube غير صالح.");
            
            const apiUrl = `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(ytUrl)}`;
            const res = await fetch(apiUrl);
            const data = await res.json();
            
            if (!data.status || !data.result) {
                throw new Error(data.message || 'API error');
            }
            
            await sock.sendMessage(m.chat, {
                video: { url: data.result.download_url },
                mimetype: "video/mp4",
            }, { quoted: m });
        }
        // .play s <query> → search
        else if (/^s\s+/i.test(raw)) {
            const query = raw.replace(/^s\s+/i, '').trim();
            if (!query) return m.reply(`اكتب كلمات البحث بعد الأمر: ${usedPrefix + command} بحث <كلمات>`);
            
            const apiUrl = `https://api-faa.my.id/faa/youtube?q=${encodeURIComponent(query)}`;
            const res = await fetch(apiUrl);
            const data = await res.json();
            
            if (!data.status || !data.result || data.result.length === 0) {
                return m.reply(`لم يتم العثور على نتائج لعبارة «${query}».`);
            }
            
            const vids = data.result;
            const rows = vids.map((v, i) => ({
                header: `النتيجة ${i + 1}`,
                title: v.title,
                description: `القناة: ${v.channel || "-"} | المدة: ${v.duration || "-"}`,
                id: `.play ${v.link}`,
            }));
            
            await sock.client(m.chat, {
                image: { url: vids[0]?.imageUrl },
                caption: `*نتائج بحث YouTube*\n\nاختر فيديو من القائمة.\n\n*البحث:* ${query}\n*عدد النتائج:* ${vids.length}`,
                footer: `نتائج البحث عن «${query}»`,
                interactiveButtons: [{
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                        title: "اختر فيديو",
                        sections: [{
                            title: `النتائج (${vids.length})`,
                            rows,
                        }],
                    }),
                }],
            }, { quoted: m });
        }
        // .play <url> → MP3
        else if (extractUrl(raw)) {
            const ytUrl = extractUrl(raw);
            const apiUrl = `https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(ytUrl)}`;
            
            const res = await fetch(apiUrl);
            const data = await res.json();
            
            if (!data.status || !data.result) {
                throw new Error(data.message || 'API error');
            }
            
            const { title, thumbnail, mp3 } = data.result;
            
            await sock.sendMessage(m.chat, {
                audio: { url: mp3 },
                mimetype: "audio/mpeg",
                contextInfo: {
                    externalAdReply: {
                        title: title || 'YouTube Audio',
                        body: 'تم التنزيل من YouTube',
                        thumbnailUrl: thumbnail,
                        mediaUrl: ytUrl,
                        mediaType: 2,
                        renderLargerThumbnail: true,
                    },
                },
            }, { quoted: m });
        }
        // .play <query> → search & play audio
        else {
            const query = encodeURIComponent(raw);
            const apiUrl = `https://api-faa.my.id/faa/ytplay?query=${query}`;
            
            const res = await fetch(apiUrl);
            const data = await res.json();
            
            if (!data.status || !data.result) {
                throw new Error(data.message || 'API error');
            }
            
            const { title, author, thumbnail, url, mp3 } = data.result;
            
            await sock.sendMessage(m.chat, {
                audio: { url: mp3 },
                mimetype: "audio/mpeg",
                contextInfo: {
                    externalAdReply: {
                        title: title || 'YouTube Audio',
                        body: author || 'غير معروف',
                        thumbnailUrl: thumbnail,
                        mediaUrl: url,
                        mediaType: 2,
                        renderLargerThumbnail: true,
                    },
                },
            }, { quoted: m });
        }
    } catch (e) {
        global.logger?.error(e, "YouTube command failed");
        m.reply("تعذّر جلب المحتوى من YouTube. حاول مرة أخرى لاحقًا.");
    } finally {
        await global.loading(m, sock, true);
    }
};

handler.help = ["play", "p", "شغل", "بحث", "فيديو"];
handler.tags = ["downloader"];
handler.command = /^(play|p|شغل|بحث|فيديو)$/iu;

export default handler;