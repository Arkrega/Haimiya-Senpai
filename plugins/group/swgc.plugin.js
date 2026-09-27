import { downloadMediaMessage, prepareWAMessageMedia } from "@itsliaaa/baileys";
import { Button } from "../../utils/MessageBuilderV4.7.js";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const sessions = new Map();

export default {
  name: "Status Group",
  command: ["swgc", "statusgroup", "swgcsend"],
  owner_only: true,
  private_only: false,
  group_only: false,
  description: "Send status to selected groups using local temp file",
  category: "owner",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    if (command === "swgc" || command === "statusgroup") {
      const contentText = args.join(" ");

      let quoted = m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || m?.extendedTextMessage?.contextInfo?.quotedMessage;
      let mediaMessage = null;
      let messageType = "text";

      if (quoted) {
        mediaMessage = { key: m.key, message: quoted };
        if (quoted.imageMessage) messageType = "image";
        else if (quoted.videoMessage) messageType = "video";
        else if (quoted.audioMessage) messageType = "audio";
      } else if (m.imageMessage || m.videoMessage || m.audioMessage) {
        mediaMessage = { key: m.key, message: m };
        if (m.imageMessage) messageType = "image";
        else if (m.videoMessage) messageType = "video";
        else if (m.audioMessage) messageType = "audio";
      }

      let filePath = null;

      if (messageType !== "text") {
        const buffer = await downloadMediaMessage(
          mediaMessage,
          "buffer",
          {},
          { logger: undefined, reuploadRequest: conn.updateMediaMessage }
        );
        if (!buffer?.length) return await m.reply("Gagal mengunduh media.");

        const ext = messageType === "image" ? "jpg" : messageType === "video" ? "mp4" : "mp3";
        filePath = path.join(os.tmpdir(), `swgc_${crypto.randomBytes(6).toString("hex")}.${ext}`);
        fs.writeFileSync(filePath, buffer);
      } else if (!contentText) {
        return await m.reply("Teks status tidak boleh kosong.");
      }

      const sessionId = m.sender;
      if (sessions.has(sessionId)) {
        const oldSession = sessions.get(sessionId);
        if (oldSession.filePath && fs.existsSync(oldSession.filePath)) {
          fs.unlinkSync(oldSession.filePath);
        }
        clearTimeout(oldSession.timeout);
      }

      const timeout = setTimeout(() => {
        if (sessions.has(sessionId)) {
          const sess = sessions.get(sessionId);
          if (sess.filePath && fs.existsSync(sess.filePath)) {
            fs.unlinkSync(sess.filePath);
          }
          sessions.delete(sessionId);
        }
      }, 5 * 60 * 1000);

      sessions.set(sessionId, {
        messageType,
        contentText,
        filePath,
        timeout
      });

      const groups = await conn.groupFetchAllParticipating();
      const groupList = Object.values(groups).slice(0, 15);

      if (groupList.length === 0) return await m.reply("Bot tidak tergabung dalam grup mana pun.");

      const builder = new Button(conn)
        .setTitle("Pilih Group Tujuan")
        .setBody("Media disimpan di penyimpanan sementara selama 5 menit.\nSilakan pilih grup tujuan.")
        .setFooter("SWGC Auto Status")
        .addSelection("Daftar Group");

      builder.makeSection("Grup Tersedia", "");
      groupList.forEach(group => {
        builder.makeRow("", group.subject, "", `${usedPrefix}swgcsend ${group.id}`);
      });

      await builder.send(jid, { quoted: m });
      return;
    }

    if (command === "swgcsend") {
      const targetJid = args[0];
      if (!targetJid || !targetJid.endsWith("@g.us")) return await m.reply("ID Grup tidak valid.");

      const session = sessions.get(m.sender);
      if (!session) return await m.reply(`Sesi 5 menit telah berakhir atau data belum disiapkan.`);

      const { messageType, contentText, filePath } = session;

      try {
        let payload = {};

        if (messageType === "text") {
          payload = { text: contentText, groupStatus: true };
        } else {
          if (!fs.existsSync(filePath)) return await m.reply("File media sudah terhapus dari sistem.");
          const buffer = fs.readFileSync(filePath);

          if (messageType === "image") {
            payload = { image: buffer, caption: contentText || "", groupStatus: true };
          } else if (messageType === "video") {
            payload = { video: buffer, caption: contentText || "", groupStatus: true };
          } else if (messageType === "audio") {
            payload = { audio: buffer, mimetype: "audio/mp4", ptt: true, groupStatus: true };
          }
        }

        if (conn.giftedStatus && typeof conn.giftedStatus.sendGroupStatus === "function") {
          await conn.giftedStatus.sendGroupStatus(targetJid, payload);
        } else {
          await conn.sendMessage(targetJid, payload);
        }

        await m.reply(`Status berhasil dikirim ke grup:\nID: ${targetJid}`);
      } catch (err) {
        console.error(err);
        await m.reply("Terjadi kesalahan saat mengirim status ke grup tersebut.");
      }
    }
  }
};