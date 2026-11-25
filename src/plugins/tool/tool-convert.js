/**
 * @file Convert stickers to images and videos to audio
 * @license Apache-2.0
 */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const child = spawn("ffmpeg", args, { stdio: "ignore" });
        let settled = false;
        const finish = (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            error ? reject(error) : resolve();
        };
        const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
        timer.unref?.();
        child.once("error", finish);
        child.once("close", (code) => {
            finish(code === 0 ? null : new Error("FFmpeg conversion failed"));
        });
    });
}

const handler = async (m, { sock, command }) => {
    const quoted = m.quoted || m;
    const type = quoted.mediaType || quoted.mtype;
    const isPhoto = command === "photo";
    if (isPhoto && type !== "stickerMessage") {
        return m.reply("رد على ملصق ثابت لاستخراج صورته.");
    }
    if (!isPhoto && type !== "videoMessage") {
        return m.reply("رد على فيديو لتحويل صوته إلى MP3.");
    }

    const buffer = await quoted.download?.();
    if (!buffer?.length) return m.reply("تعذّر تنزيل الوسائط.");
    if (buffer.length > MAX_INPUT_BYTES) {
        return m.reply("حجم الملف يجب ألا يتجاوز 20 ميغابايت.");
    }

    let directory;
    try {
        directory = await mkdtemp(join(tmpdir(), "bot-convert-"));
        const input = join(directory, isPhoto ? "input.webp" : "input.mp4");
        const output = join(directory, isPhoto ? "output.png" : "output.mp3");
        await writeFile(input, buffer);

        const args = isPhoto
            ? ["-nostdin", "-hide_banner", "-loglevel", "error", "-threads", "1", "-y", "-i", input, "-frames:v", "1", output]
            : ["-nostdin", "-hide_banner", "-loglevel", "error", "-threads", "1", "-y", "-i", input, "-t", "120", "-vn", "-c:a", "libmp3lame", "-b:a", "128k", output];
        await runFfmpeg(args);

        const result = await readFile(output);
        if (!result.length || result.length > MAX_OUTPUT_BYTES) {
            throw new Error("Converted file is empty or too large");
        }

        if (isPhoto) {
            return await sock.sendMessage(m.chat, { image: result, mimetype: "image/png" }, { quoted: m });
        }
        return await sock.sendMessage(
            m.chat,
            { audio: result, mimetype: "audio/mpeg", ptt: false },
            { quoted: m }
        );
    } catch (error) {
        global.logger?.error(error, "Media conversion failed");
        return m.reply("تعذّر تحويل الملف. تأكد أن الفيديو يحتوي على صوت.");
    } finally {
        if (directory) await rm(directory, { recursive: true, force: true });
    }
};

handler.help = ["photo", "toaudio"];
handler.tags = ["tools"];
handler.command = /^(photo|toaudio)$/iu;

export default handler;
