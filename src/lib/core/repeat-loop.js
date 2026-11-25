let activeLoop = null;

export const MAX_REPEAT_MESSAGES = 10;

export function clampRepeatMessageLimit(value) {
    if (!Number.isInteger(value) || value <= 0) return MAX_REPEAT_MESSAGES;
    return Math.min(value, MAX_REPEAT_MESSAGES);
}

export function isRepeatLoopActive() {
    return activeLoop !== null;
}

export function startRepeatLoop({
    sock,
    chat,
    text,
    intervalMs,
    maxMessages = MAX_REPEAT_MESSAGES,
}) {
    if (activeLoop) return false;
    if (
        !sock ||
        typeof sock.sendMessage !== "function" ||
        typeof chat !== "string" ||
        typeof text !== "string" ||
        !Number.isFinite(intervalMs) ||
        intervalMs < 1000
    ) {
        return false;
    }

    const session = {
        sock,
        chat,
        text,
        intervalMs,
        sent: 0,
        timer: null,
        maxMessages: clampRepeatMessageLimit(maxMessages),
    };

    activeLoop = session;

    const sendNext = async () => {
        if (activeLoop !== session) return;

        try {
            await sock.sendMessage(chat, { text });
            session.sent += 1;
        } catch (error) {
            global.logger?.error(
                { error: error?.message || "Unknown send error" },
                "Repeat message failed"
            );
            stopRepeatLoop();
            return;
        }

        if (activeLoop !== session) return;
        if (session.sent >= session.maxMessages) {
            stopRepeatLoop();
            return;
        }

        session.timer = setTimeout(sendNext, intervalMs);
    };

    void sendNext();
    return true;
}

export function stopRepeatLoop() {
    if (!activeLoop) return false;

    if (activeLoop.timer) {
        clearTimeout(activeLoop.timer);
    }

    activeLoop = null;
    return true;
}
