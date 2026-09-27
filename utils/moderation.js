import { getGroupData, updateGroupData, addWarn, resetWarn } from "./database.js";

const spamMsgMap = new Map();
const spamStickerMap = new Map();

export async function handleModeration(conn, m, { isAdmin, isBotAdmin, isOwner }) {
  if (!m.isGroup || m.isFromMe) return false;

  const groupData = getGroupData(m.jid);

  if (groupData.muted_users.includes(m.sender)) {
    if (isBotAdmin) await m.delete();
    return true;
  }

  if (isAdmin || isOwner || groupData.whitelist_users.includes(m.sender)) return false;

  let isViolate = false;
  let violationType = "";
  const text = m.text || "";

  let isWhitelistedDomain = false;
  for (const domain of groupData.whitelist_domains) {
    if (text.includes(domain)) {
      isWhitelistedDomain = true;
      break;
    }
  }

  if (!isWhitelistedDomain) {
    const regexWA = /chat\.whatsapp\.com\/[a-zA-Z0-9]+/i;
    const regexTG = /t\.me\/[a-zA-Z0-9_]+/i;
    const regexDC = /discord\.(gg|com\/invite)\/[a-zA-Z0-9]+/i;
    const regexYT = /(youtube\.com|youtu\.be|tiktok\.com|vt\.tiktok\.com)\/[a-zA-Z0-9_\-\/?=&]+/i;

    if (groupData.antilink_wa && regexWA.test(text)) { isViolate = true; violationType = "Link WhatsApp"; }
    else if (groupData.antilink_tg && regexTG.test(text)) { isViolate = true; violationType = "Link Telegram"; }
    else if (groupData.antilink_dc && regexDC.test(text)) { isViolate = true; violationType = "Link Discord"; }
    else if (groupData.antilink_yt_tt && regexYT.test(text)) { isViolate = true; violationType = "Link YouTube/TikTok"; }
  }

  if (groupData.antibot && m.id.startsWith("BAE5") && m.id.length === 16) {
    isViolate = true;
    violationType = "Bot Lain";
  }

  const now = Date.now();
  const spamKey = `${m.jid}-${m.sender}`;

  if (groupData.antispam && !m.isSticker) {
    if (!spamMsgMap.has(spamKey)) spamMsgMap.set(spamKey, []);
    let userMsgs = spamMsgMap.get(spamKey).filter(time => now - time < 5000);
    userMsgs.push(now);
    spamMsgMap.set(spamKey, userMsgs);

    if (userMsgs.length > 5) {
      isViolate = true;
      violationType = "Spam Pesan";
    }
  }

  if (groupData.antisticker && m.isSticker) {
    if (!spamStickerMap.has(spamKey)) spamStickerMap.set(spamKey, []);
    let userStickers = spamStickerMap.get(spamKey).filter(time => now - time < 5000);
    userStickers.push(now);
    spamStickerMap.set(spamKey, userStickers);

    if (userStickers.length > 5) {
      isViolate = true;
      violationType = "Spam Sticker";
    }
  }

  if (isViolate) {
    const sendActionMsg = async (act, extra = "") => {
      let txt = `🚨 *Pelanggaran Terdeteksi*\n\n`;
      txt += `👤 User: @${m.sender.split('@')[0]}\n`;
      txt += `⚠️ Pelanggaran: ${violationType}\n`;
      txt += `🛑 Tindakan: ${act}`;
      if (extra) txt += `\n📝 Note: ${extra}`;
      
      await conn.sendMessage(m.jid, { text: txt, mentions: [m.sender] });
    };

    if (isBotAdmin) {
      const action = groupData.action;
      
      if (action === "delete") {
        await m.delete();
        await sendActionMsg("Hapus Pesan");
      } else if (action === "kick") {
        await m.delete();
        await conn.groupParticipantsUpdate(m.jid, [m.sender], "remove");
        await sendActionMsg("Kick (Dikeluarkan)");
      } else if (action === "mute") {
        await m.delete();
        const muted = groupData.muted_users;
        if (!muted.includes(m.sender)) {
          muted.push(m.sender);
          updateGroupData(m.jid, "muted_users", muted);
        }
        await sendActionMsg("Mute (Dibisukan)");
      } else if (action === "warn") {
        await m.delete();
        const currentWarn = addWarn(m.sender, m.jid);
        if (currentWarn >= groupData.max_warn) {
          await conn.groupParticipantsUpdate(m.jid, [m.sender], "remove");
          await sendActionMsg("Kick (Dikeluarkan)", `Batas peringatan tercapai (${currentWarn}/${groupData.max_warn})`);
          resetWarn(m.sender, m.jid);
        } else {
          await sendActionMsg("Peringatan", `Peringatan ke-${currentWarn} dari maksimal ${groupData.max_warn}`);
        }
      }
    } else {
      await sendActionMsg("Gagal", "Bot tidak memiliki akses Admin");
    }
    return true;
  }
  return false;
}