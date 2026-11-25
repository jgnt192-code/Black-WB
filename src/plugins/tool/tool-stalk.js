/**
 * @file Universal stalker for WhatsApp, TikTok, and social media profiles
 * @module plugins/tool/stalk
 * @license Apache-2.0
 * @author Naruya Izumi
 */

let handler = async (m, { sock, text, args, usedPrefix, command }) => {
    try {
        const f = args[0]?.toLowerCase();
        
        const inp =
            m.mentionedJid?.[0] ||
            m.quoted?.sender ||
            (text && /^\d+$/.test(text) ? text + "@s.whatsapp.net" :
                null);
        
        if (f !== "-g" && f !== "-c" && f !== "-tt" && !inp) {
            return m.reply(
                `*معلومات الحسابات*\n\n` +
                `*واتساب:*\n` +
                `- ${usedPrefix + command} <رقم دولي>\n` +
                `- ${usedPrefix + command} @منشن أو بالرد على رسالة\n` +
                `- ${usedPrefix + command} -g — معلومات المجموعة الحالية\n` +
                `- ${usedPrefix + command} -g <رابط دعوة>\n` +
                `- ${usedPrefix + command} -c <رابط قناة>\n\n` +
                `*TikTok:*\n` +
                `- ${usedPrefix + command} -tt <اسم المستخدم>`
            );
        }
        
        await global.loading(m, sock);
        
        if (f === "-g") {
            return await grpinfo(m, sock, args.slice(1).join(" "));
        }
        
        if (f === "-c") {
            return await chinfo(m, sock, args.slice(1).join(" "));
        }
        
        if (f === "-tt") {
            const username = args.slice(1).join(" ").trim();
            if (!username) {
                return m.reply(
                    `اكتب اسم مستخدم TikTok.\n\nمثال: ${usedPrefix + command} -tt <اسم المستخدم>`
                    );
            }
            return await tiktokStalk(m, sock, username);
        }
        
        await usrinfo(m, sock, inp);
        
        async function usrinfo(m, sock, inp) {
            const lid = inp.endsWith("@lid") ?
                inp :
                await sock.signalRepository.lidMapping.getLIDForPN(
                    inp);
            
            if (!lid) return m.reply(
                "تعذّر العثور على معرّف هذا المستخدم.");
            
            const jid = await sock.signalRepository.lidMapping
                .getPNForLID(lid);
            if (!jid) return m.reply(
                "تعذّر العثور على عنوان واتساب لهذا المستخدم.");
            
            const [ex] = await sock.onWhatsApp(jid);
            if (!ex?.exists) {
                return m.reply(
                    "هذا الرقم غير مسجل في واتساب."
                    );
            }
            
            const pp =
                (await sock.profilePictureUrl(jid, "image").catch(
                () => null)) ||
                "https://qu.ax/jVZhH.jpg";
            
            const stsRes = await sock.fetchStatus(jid).catch(() =>
                null);
            const sts = stsRes?.[0]?.status;
            const bio = sts?.status?.trim() || null;
            const setAt = sts?.setAt ? new Date(sts.setAt) : null;
            
            const bis = await sock.getBusinessProfile(jid).catch(
            () => null);
            const isBiz = bis && (bis.description || bis.category);
            
            const decodedJid = sock.decodeJid?.(jid) || jid.replace(
                /:0$/, "");
            
            let cap = isBiz ?
                "*ملف نشاط واتساب*\n\n" :
                "*ملف مستخدم واتساب*\n\n";

            cap += `المستخدم: @${lid.split("@")[0]}\n`;
            cap += `معرّف LID: \`${lid}\`\n`;
            cap += `عنوان JID: \`${decodedJid}\`\n`;
            
            if (bio) {
                cap += `الحالة: ${bio}\n`;
                if (setAt) cap +=
                    `آخر تحديث: ${fmttime(setAt)}\n`;
            } else {
                cap += `الحالة: غير محددة\n`;
            }
            
            if (isBiz) {
                cap += `\n*معلومات النشاط*\n`;
                
                if (bis.description) {
                    cap +=
                    `الوصف: ${bis.description}\n`;
                }
                
                if (bis.category) {
                    const cat = Array.isArray(bis.category) ?
                        bis.category.join(", ") :
                        bis.category;
                    cap += `الفئة: ${cat}\n`;
                }
                
                if (bis.email) {
                    cap += `البريد الإلكتروني: ${bis.email}\n`;
                }
                
                if (bis.website?.length) {
                    cap += `الموقع الإلكتروني:\n`;
                    bis.website.forEach((url) => {
                        cap += `- ${url}\n`;
                    });
                }
                
                if (bis.address) {
                    cap += `العنوان: ${bis.address}\n`;
                }
                
                if (bis.business_hours?.business_config?.length) {
                    cap += `\n*ساعات العمل*\n`;
                    cap +=
                        `المنطقة الزمنية: ${bis.business_hours.timezone || "UTC"}\n`;
                    cap += fmtbizhours(bis.business_hours
                        .business_config);
                }
            }
            
            // Buttons for user stalk
            const btns = [
            {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: "نسخ معرّف LID",
                    copy_code: lid,
                }),
            },
            {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: "نسخ عنوان JID",
                    copy_code: decodedJid,
                }),
            }, ];
            
            await sock.client(
                m.chat,
                pp ?
                {
                    image: { url: pp },
                    caption: cap.trim(),
                    title: isBiz ? "ملف نشاط واتساب" :
                        "ملف مستخدم واتساب",
                    footer: "معلومات ملف واتساب",
                    interactiveButtons: btns,
                    hasMediaAttachment: true,
                    mentions: [lid],
                } :
                {
                    text: cap.trim(),
                    title: isBiz ? "ملف نشاط واتساب" :
                        "ملف مستخدم واتساب",
                    footer: "معلومات ملف واتساب",
                    interactiveButtons: btns,
                    mentions: [lid],
                }
            );
        }
        
        async function grpinfo(m, sock, arg) {
            let meta;
            let gid;
            let invLink = null;
            
            if (arg) {
                let invCode = null;
                
                // Try to parse as a full URL first
                try {
                    const url = new URL(arg);
                    if (url.hostname === "chat.whatsapp.com") {
                        // Expect the invite code as the first non-empty path segment
                        const segments = url.pathname.split("/").filter(Boolean);
                        if (segments.length > 0 && /^[A-Za-z0-9]+$/.test(segments[0])) {
                            invCode = segments[0];
                        }
                    }
                } catch {
                    // Not a valid URL; fall through and treat arg as a possible raw invite code
                }
                
                // If not a valid URL-based invite, check if arg itself is a plausible invite code
                if (!invCode && /^[A-Za-z0-9]+$/.test(arg)) {
                    invCode = arg;
                }
                
                if (invCode) {
                    invLink = `https://chat.whatsapp.com/${invCode}`;
                    try {
                        meta = await sock.groupGetInviteInfo(invCode);
                        gid = meta.id;
                    } catch (e) {
                        return m.reply(
                            "تعذّر جلب معلومات المجموعة. تحقق من صلاحية رابط الدعوة."
                        );
                    }
                } else {
                    // As a final check, see if the argument is a URL pointing to chat.whatsapp.com
                    try {
                        const fallbackUrl = new URL(arg);
                        if (fallbackUrl.hostname === "chat.whatsapp.com") {
                            // User attempted to provide a WhatsApp invite link but it is malformed
                            return m.reply("رابط دعوة المجموعة غير صالح.");
                        }
                    } catch {
                        // Not a valid URL; do not treat it as a WhatsApp invite link
                    }
                }
            }
            
            if (!meta) {
                if (!m.isGroup) {
                    return m.reply(
                        "استخدم الأمر داخل مجموعة أو أرسل رابط دعوة صالحًا."
                    );
                }
                
                gid = m.chat;
                
                try {
                    const chatData = await sock.getChat(gid);
                    if (chatData?.metadata?.participants?.length) {
                        meta = chatData.metadata;
                    }
                } catch {
                    // Silent fail
                }
                
                if (!meta) {
                    try {
                        meta = await sock.groupMetadata(gid);
                        
                        try {
                            const chatData = (await sock.getChat(
                                gid)) || { id: gid };
                            chatData.metadata = meta;
                            chatData.subject = meta.subject;
                            chatData.isChats = true;
                            chatData.lastSync = Date.now();
                            await sock.setChat(gid, chatData);
                        } catch {
                            // Silent fail
                        }
                    } catch (e) {
                        global.logger?.error(e, "Group information lookup failed");
                        return m.reply("تعذّر جلب معلومات المجموعة.");
                    }
                }
            }
            
            const mem = meta.participants || [];
            const adm = mem.filter((p) => p.admin);
            const own =
                meta.subjectOwner ||
                adm.find((p) => p.admin === "superadmin")?.id ||
                gid.split("-")[0] + "@s.whatsapp.net";
            
            const admList =
                adm.length > 0 ?
                adm
                .map(
                    (v, i) =>
                    `- ${i + 1}. @${(v.id || v.phoneNumber).split("@")[0]}`
                )
                .join("\n") :
                "لا يوجد مشرفون";
            
            const ephTime = {
                86400: "24 ساعة",
                604800: "7 أيام",
                2592000: "30 يومًا",
                7776000: "90 يومًا",
            } [meta.ephemeralDuration] || "معطّل";
            
            const desc = meta.desc || "لا يوجد وصف.";
            
            let pp = null;
            try {
                pp = await sock.profilePictureUrl(gid, "image");
            } catch {
                // Silent fail
            }
            
            const men = [...new Set([...adm.map((v) => v.id || v
                .phoneNumber), own])];
            
            const fmtval = (val) => {
                if (
                    !val ||
                    val === "undefined" ||
                    val === "null" ||
                    val === "None" ||
                    val === "Unknown" ||
                    val === ""
                ) {
                    return "غير متاح";
                }
                return val;
            };
            
            const cap = `
*معلومات المجموعة*

المعرّف: \`${fmtval(meta.id)}\`
نمط العناوين: ${fmtval(meta.addressingMode)}
الاسم: ${fmtval(meta.subject)}
المالك: ${meta.subjectOwner ? `@${meta.subjectOwner.split("@")[0]}` : "غير متاح"}
آخر تحديث: ${meta.subjectTime ? fmttime(new Date(meta.subjectTime * 1000)) : "غير متاح"}
عدد الأعضاء: ${fmtval(meta.size || mem.length)}
تاريخ الإنشاء: ${meta.creation ? fmttime(new Date(meta.creation * 1000)) : "غير متاح"}
المجموعة الرئيسية: ${fmtval(meta.linkedParent)}

*المشرفون*
${admList}

*الوصف*
${desc}

*إعدادات المجموعة*
تقييد الإرسال: ${meta.restrict ? "مفعّل" : "معطّل"}
الإعلان: ${meta.announce ? "للمشرفين فقط" : "لجميع الأعضاء"}
مجتمع: ${meta.isCommunity ? "نعم" : "لا"}
إعلان المجتمع: ${meta.isCommunityAnnounce ? "مفعّل" : "معطّل"}
الموافقة على الانضمام: ${meta.joinApprovalMode ? "مطلوبة" : "غير مطلوبة"}
إضافة الأعضاء: ${meta.memberAddMode ? "للمشرفين فقط" : "متاحة"}
الرسائل المؤقتة: ${ephTime}
`.trim();
            
            // Buttons for group stalk
            const btns = [
            {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: "نسخ معرّف المجموعة",
                    copy_code: gid,
                }),
            }, ];
            
            if (invLink) {
                btns.push({
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                        display_text: "فتح رابط الدعوة",
                        url: invLink,
                    }),
                });
            }
            
            await sock.client(
                m.chat,
                pp ?
                {
                    image: { url: pp },
                    caption: cap,
                    title: "معلومات المجموعة",
                    footer: "تفاصيل مجموعة واتساب",
                    interactiveButtons: btns,
                    hasMediaAttachment: true,
                    mentions: men,
                } :
                {
                    text: cap,
                    title: "معلومات المجموعة",
                    footer: "تفاصيل مجموعة واتساب",
                    interactiveButtons: btns,
                    mentions: men,
                }
            );
        }
        
        async function chinfo(m, sock, arg) {
            if (!arg || !arg.includes("whatsapp.com/channel/")) {
                return m.reply(
                    "أرسل رابط دعوة صالحًا لقناة واتساب."
                    );
            }
            
            const match = arg.match(/channel\/([A-Za-z0-9]+)/);
            if (!match) return m.reply(
                "رابط دعوة القناة غير صالح.");
            
            const invCode = match[1];
            const invLink =
                `https://whatsapp.com/channel/${invCode}`;
            
            let meta;
            try {
                meta = await sock.newsletterMetadata("invite",
                    invCode, "GUEST");
            } catch (e) {
                return m.reply(
                    "تعذّر جلب معلومات القناة."
                    );
            }
            
            const cid = meta.id;
            const stt = meta.state?.type || "UNKNOWN";
            const trd = meta.thread_metadata || {};
            const nam = trd.name?.text || "_Not set_";
            const desc = trd.description?.text ||
            "_No description_";
            const hdl = trd.handle || "_Not set_";
            const sub = trd.subscribers_count || "0";
            const ver = trd.verification || "UNVERIFIED";
            const rct = trd.settings?.reaction_codes?.value ||
                "UNKNOWN";
            const inv = trd.invite || invCode;
            
            const fmtval = (val) => {
                if (
                    !val ||
                    val === "undefined" ||
                    val === "null" ||
                    val === "None" ||
                    val === "Unknown" ||
                    val === ""
                ) {
                    return "غير متاح";
                }
                return val;
            };
            
            const fmtsub = (count) => {
                const num = parseInt(count) || 0;
                if (num >= 1000000) {
                    return (num / 1000000).toFixed(1) + "M";
                } else if (num >= 1000) {
                    return (num / 1000).toFixed(1) + "K";
                }
                return num.toString();
            };
            
            let pp = null;
            if (trd.preview?.direct_path) {
                pp =
                `https://mmg.whatsapp.net${trd.preview.direct_path}`;
            }
            
            const crDate =
                trd.creation_time && !isNaN(parseInt(trd
                    .creation_time)) ?
                fmttime(new Date(parseInt(trd.creation_time) *
                    1000)) :
                "غير متاح";
            
            const cap = `
*معلومات القناة*

المعرّف: \`${fmtval(cid)}\`
الحالة: ${fmtval(stt)}
الاسم: ${fmtval(nam)}
المعرّف المختصر: ${fmtval(hdl)}
رابط الدعوة: \`${fmtval(inv)}\`
عدد المتابعين: ${fmtsub(sub)}
التوثيق: ${fmtval(ver)}
تاريخ الإنشاء: ${crDate}
الصورة: ${trd.preview?.direct_path ? "متاحة" : "غير متاحة"}

*الوصف*
${desc}

*البيانات*
معرّف الوصف: \`${fmtval(trd.description?.id)}\`
معرّف الاسم: \`${fmtval(trd.name?.id)}\`
نوع المعاينة: ${fmtval(trd.preview?.type)}
التفاعلات: ${fmtval(rct)}
`.trim();
            
            // Buttons for channel stalk
            const btns = [
            {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: "نسخ معرّف القناة",
                    copy_code: cid,
                }),
            },
            {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: "فتح رابط القناة",
                    url: invLink,
                }),
            }, ];
            
            await sock.client(
                m.chat,
                pp ?
                {
                    image: { url: pp },
                    caption: cap,
                    title: "معلومات القناة",
                    footer: "تفاصيل قناة واتساب",
                    interactiveButtons: btns,
                    hasMediaAttachment: true,
                } :
                {
                    text: cap,
                    title: "معلومات القناة",
                    footer: "تفاصيل قناة واتساب",
                    interactiveButtons: btns,
                }
            );
        }
        
        async function tiktokStalk(m, sock, username) {
            const cleanUsername = username.replace(/^@/, "");
            
            let data;
            try {
                const res = await fetch(
                    `https://api-faa.my.id/faa/tiktokstalk?username=${encodeURIComponent(cleanUsername)}`
                );
                
                if (!res.ok) {
                    throw new Error(
                        `API returned ${res.status}: ${res.statusText}`
                        );
                }
                
                const json = await res.json();
                
                if (!json.status || !json.result) {
                    throw new Error("استجابة الخدمة غير صالحة.");
                }
                
                data = json.result;
            } catch (e) {
                return m.reply(
                    "تعذّر جلب معلومات حساب TikTok."
                    );
            }
            
            const fmtNum = (num) => {
                const n = parseInt(num) || 0;
                if (n >= 1000000000) return (n / 1000000000)
                    .toFixed(1) + "B";
                if (n >= 1000000) return (n / 1000000).toFixed(
                    1) + "M";
                if (n >= 1000) return (n / 1000).toFixed(1) +
                    "K";
                return n.toString();
            };
            
            const fmtDate = (timestamp) => {
                if (!timestamp) return "غير متاح";
                const date = new Date(parseInt(timestamp) *
                    1000);
                if (isNaN(date.getTime()))
                return "تاريخ غير صالح";
                
                return new Intl.DateTimeFormat("ar", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                }).format(date);
            };
            
            const cap = `
*معلومات حساب TikTok*

اسم المستخدم: @${data.username || cleanUsername}
الاسم: ${data.name || "غير محدد"}
المعرّف: \`${data.id || "غير متاح"}\`
المنطقة: ${data.region?.toUpperCase() || "غير محددة"}
موثّق: ${data.verified ? "نعم" : "لا"}
خاص: ${data.private ? "نعم" : "لا"}
حساب تجاري: ${data.seller ? "نعم" : "لا"}
نوع الحساب: ${data.organization ? "مؤسسة" : "شخصي"}
تاريخ الإنشاء: ${fmtDate(data.create_time)}

*النبذة*
${data.bio || "لا توجد نبذة"}

*الإحصاءات*
المتابعون: ${fmtNum(data.stats?.followers || 0)}
يتابع: ${fmtNum(data.stats?.following || 0)}
الإعجابات: ${fmtNum(data.stats?.likes || 0)}
الفيديوهات: ${fmtNum(data.stats?.videos || 0)}
الأصدقاء: ${fmtNum(data.stats?.friend || 0)}

*التفاعل*
المشاهدات الأخيرة: ${fmtNum(data.recent_view || 0)}
المتابعون الجدد: ${fmtNum(data.new_followers || 0)}
الحالة: ${data.story ? "متاحة" : "غير متاحة"}
`.trim();
            
            const profLink = data.link ||
                `https://www.tiktok.com/@${cleanUsername}`;
            
            // Buttons for TikTok stalk
            const btns = [
            {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: "فتح الحساب",
                    url: profLink,
                }),
            }, ];
            
            await sock.client(
                m.chat,
                data.avatar ?
                {
                    image: { url: data.avatar },
                    caption: cap,
                    title: "حساب TikTok",
                    footer: "معلومات TikTok",
                    interactiveButtons: btns,
                    hasMediaAttachment: true,
                } :
                {
                    text: cap,
                    title: "حساب TikTok",
                    footer: "معلومات TikTok",
                    interactiveButtons: btns,
                }
            );
        }
        
        function fmttime(d) {
            if (!(d instanceof Date) || isNaN(d.getTime())) {
                return "تاريخ غير صالح";
            }
            
            return (
                new Intl.DateTimeFormat("ar", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "Africa/Tripoli",
                }).format(d) + " بتوقيت طرابلس"
            );
        }
        
        function fmtbizhours(cfg) {
            if (!Array.isArray(cfg) || cfg.length === 0) {
                return "لم تُحدد ساعات العمل.\n";
            }
            
            const dayOrd = ["sun", "mon", "tue", "wed", "thu", "fri",
                "sat"
            ];
            const dayMap = {
                sun: "الأحد",
                mon: "الإثنين",
                tue: "الثلاثاء",
                wed: "الأربعاء",
                thu: "الخميس",
                fri: "الجمعة",
                sat: "السبت",
            };
            
            const cfgMap = {};
            cfg.forEach((c) => {
                cfgMap[c.day_of_week] = c;
            });
            
            let res = "";
            dayOrd.forEach((day) => {
                const dayNam = dayMap[day];
                const c = cfgMap[day];
                
                if (c) {
                    if (c.mode === "open_24h") {
                        res +=
                            `${dayNam}: مفتوح طوال اليوم\n`;
                    } else if (c.mode === "specific_hours") {
                        const opn = mintotime(c.open_time);
                        const cls = mintotime(c.close_time);
                        res +=
                            `${dayNam}: ${opn} - ${cls}\n`;
                    } else {
                        res += `${dayNam}: مغلق\n`;
                    }
                } else {
                    res += `${dayNam}: مغلق\n`;
                }
            });
            
            return res;
        }
        
        function mintotime(min) {
            const m = typeof min === "string" ? parseInt(min, 10) : min;
            
            if (isNaN(m) || m < 0) {
                return "00:00";
            }
            
            const h = Math.floor(m / 60);
            const n = m % 60;
            return `${String(h).padStart(2, "0")}:${String(n).padStart(2, "0")}`;
        }
    } catch (e) {
        global.logger?.error(e, "Account information lookup failed");
        m.reply("تعذّر جلب المعلومات المطلوبة. تحقق من الرابط أو اسم المستخدم.");
    } finally {
        await global.loading(m, sock, true);
    }
};

handler.help = ["stalk", "معلومات"];
handler.tags = ["tools"];
handler.command = /^(stalk|معلومات)$/iu;

export default handler;