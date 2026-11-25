/**
 * @file OpenAI-backed assistant command
 * @license Apache-2.0
 */

const MODEL = "gpt-4.1-mini";
const AI_BRAND = "៹࣪˖ 𝕭l̤̮ḁ̥̥̊̊̊͜͡c̾k̶⋄.⸙";
const MAX_PROMPT_LENGTH = 4000;
const MAX_REPLY_LENGTH = 3500;
const AI_REQUESTS_PER_HOUR = 10;
const AI_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const AI_REQUEST_COOLDOWN_MS = 15 * 1000;
const userRequests = new Map();
const buildInstructions = (isOwner) =>
    [
        "أنت مساعد دردشة عربي طبيعي وواضح. افهم لهجات العربية واستخدم لهجة المستخدم متى أمكن، ومنها الجزائرية والليبية والعراقية والمصرية والشامية والخليجية، من دون تصنّع أو ادعاء أنك من منطقة معينة. إذا لم تتأكد من اللهجة فاستخدم عربية سهلة.",
        "طابق نبرة المستخدم: احترم من يخاطبك باحترام. إذا بدأ المستخدم بمزاح خشن أو شتائم، يمكنك مجاراته أحيانًا بلفظ عامي خفيف في سياق مزاح واضح، لكن لا تصعّد ولا تستخدم تهديدات أو تحقيرًا قائمًا على الهوية أو ألفاظًا مهينة قاسية. في الأمور الجدية أو الحساسة ابقَ هادئًا ومحترمًا.",
        "كن مختصرًا ومفيدًا، وميّز بين الرأي والحقيقة. لا تدّعِ تنفيذ أفعال خارج المحادثة.",
        isOwner
            ? "المرسل هو مالك البوت الموثّق. خاطبه بودّ واهتمام خاصين، وقدّم تقديرًا أو إطراءً بسيطًا وصادقًا عندما يلائم السياق، من دون مبالغة أو اختلاق، ولا تتجاوز الدقة أو السلامة لإرضائه."
            : "لا تفترض أن المرسل هو مالك البوت ولا تكشف بياناته. خاطب المستخدم وفق نبرته مع الحفاظ على الاحترام.",
    ].join("\n");

function reserveUserRequest(userId, now = Date.now()) {
    const history = (userRequests.get(userId) || [])
        .filter((timestamp) => now - timestamp < AI_REQUEST_WINDOW_MS);
    const mostRecent = history.at(-1);

    if (mostRecent && now - mostRecent < AI_REQUEST_COOLDOWN_MS) {
        return {
            text: `انتظر ${Math.ceil((AI_REQUEST_COOLDOWN_MS - (now - mostRecent)) / 1000)} ثانية قبل طلب آخر.`,
        };
    }

    if (history.length >= AI_REQUESTS_PER_HOUR) {
        const waitMs = Math.max(1000, history[0] + AI_REQUEST_WINDOW_MS - now);
        return {
            text: `وصلت إلى الحد المسموح: ${AI_REQUESTS_PER_HOUR} طلبات في الساعة. جرّب بعد ${Math.ceil(waitMs / 60000)} دقيقة.`,
        };
    }

    userRequests.set(userId, [...history, now]);
    if (userRequests.size > 1000) {
        for (const [key, timestamps] of userRequests) {
            const recent = timestamps.filter(
                (timestamp) => now - timestamp < AI_REQUEST_WINDOW_MS
            );
            if (recent.length) userRequests.set(key, recent);
            else userRequests.delete(key);
        }
    }
    return null;
}

function extractText(response) {
    if (typeof response?.output_text === "string") return response.output_text.trim();
    return (response?.output || [])
        .filter((item) => item.type === "message" && item.role === "assistant")
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text" && typeof item.text === "string")
        .map((item) => item.text)
        .join("\n")
        .trim();
}

const handler = async (m, { sock, args, usedPrefix, command, isOwner }) => {
    const prompt = args.join(" ").trim();
    if (!prompt) {
        return m.reply(`اكتب سؤالك بعد الأمر.\nمثال: ${usedPrefix + command} اشرح لي الفكرة باختصار`);
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
        return m.reply(`الحد الأقصى للسؤال ${MAX_PROMPT_LENGTH} حرف.`);
    }

    const apiKey = Bun.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        return m.reply("أمر الذكاء الاصطناعي غير مفعّل بعد؛ أضف OPENAI_API_KEY إلى أسرار المشروع.");
    }

    const userId = m.sender || m.key?.participant;
    if (!userId) return m.reply("تعذّر تحديد المستخدم. حاول إرسال الأمر مرة أخرى.");

    const limit = reserveUserRequest(userId);
    if (limit) return m.reply(limit.text);

    await global.loading(m, sock);
    try {
        const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: MODEL,
                instructions: buildInstructions(Boolean(isOwner)),
                input: prompt,
                max_output_tokens: 700,
                store: false,
            }),
            signal: AbortSignal.timeout(45_000),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                return m.reply("رفض OpenAI المفتاح. تحقق من المفتاح وصلاحيته في أسرار المشروع.");
            }
            if (response.status === 429) {
                return m.reply("وصل حساب OpenAI إلى حد الاستخدام أو يحتاج إلى رصيد.");
            }
            global.logger?.warn({ status: response.status }, "OpenAI request failed");
            return m.reply("تعذّر الحصول على إجابة من OpenAI الآن.");
        }

        const answer = extractText(data);
        if (!answer) return m.reply("لم يرجع OpenAI إجابة نصية.");
        const clipped = answer.length > MAX_REPLY_LENGTH
            ? `${answer.slice(0, MAX_REPLY_LENGTH)}\n\n[تم اختصار الرد]`
            : answer;
        return sock.sendMessage(
            m.chat,
            { text: `${clipped}\n\n${AI_BRAND}` },
            { quoted: m }
        );
    } catch (error) {
        global.logger?.warn({ error: error.name }, "OpenAI request failed");
        return m.reply("تعذّر الاتصال بخدمة الذكاء الاصطناعي. حاول مرة أخرى.");
    } finally {
        await global.loading(m, sock, true);
    }
};

handler.help = ["ai <سؤالك>", "مساعد <سؤالك>"];
handler.tags = ["ai"];
handler.command = /^(ai|مساعد)$/iu;

export default handler;
