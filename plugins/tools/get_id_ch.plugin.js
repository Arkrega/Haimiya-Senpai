import config from "../../config.js";
import { Button } from "../../utils/MessageBuilderV4.7.js";

export default {
  name: "Get Channel & Group ID",
  command: ["getchid", "getchannelid", "chid", "getgroupid", "getid", "cekidch", "cekidgc"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Mengambil ID dari tautan WhatsApp Channel atau Grup",
  category: "tools",

  async run(conn, m, { jid, args, usedPrefix }) {
    try {
      const url = args[0];

      if (!url) {
        return await m.reply(
          `❌ Silakan masukkan tautan channel atau grup WhatsApp!\n\n> *Contoh Channel:* ${usedPrefix}getid https://whatsapp.com/channel/023847293847XYZ\n> *Contoh Grup:* ${usedPrefix}getid https://chat.whatsapp.com/ABCDEFG12345`
        );
      }

      let type = "";
      let inviteCode = "";

      if (url.includes("whatsapp.com/channel/")) {
        type = "channel";
        inviteCode = url.split("channel/")[1]?.split("?")[0];
      } else if (url.includes("chat.whatsapp.com/")) {
        type = "group";
        inviteCode = url.split("chat.whatsapp.com/")[1]?.split("?")[0];
      } else {
        return await m.reply(
          "❌ Tautan tidak valid! Pastikan itu adalah link WhatsApp Channel atau Grup yang benar."
        );
      }

      if (!inviteCode) {
        return await m.reply(
          "❌ Gagal mengekstrak kode undangan dari tautan tersebut."
        );
      }

      let targetId = "Tidak dapat mendeteksi ID secara langsung";
      let targetName = "Unknown";
      let members = "Tidak diketahui";

      try {
        if (type === "channel") {
          const metadata = await conn.newsletterMetadata("invite", inviteCode);
          if (metadata) {
            targetId = metadata.id || `${inviteCode}@newsletter`;
            targetName = metadata.name || "Tidak ada nama";
            members = metadata.subscribers || "Tidak diketahui";
          }
        } else if (type === "group") {
          const metadata = await conn.groupGetInviteInfo(inviteCode);
          if (metadata) {
            targetId = metadata.id ? (metadata.id.includes("@g.us") ? metadata.id : `${metadata.id}@g.us`) : "Tidak ditemukan";
            targetName = metadata.subject || "Tidak ada nama";
            members = metadata.size || "Tidak diketahui";
          }
        }
      } catch (e) {
        targetId = type === "channel" ? `${inviteCode}@newsletter` : "Gagal mengambil data (Tautan mungkin direvoke/kadaluarsa)";
      }

      let text = `📡 *${type === "channel" ? "CHANNEL INFO" : "GROUP INFO"}*\n`;
      text += `┃ \n`;
      text += `┃ 🏷️ *Nama:* ${targetName}\n`;
      text += `┃ 🆔 *ID:* ${targetId}\n`;
      text += `┃ 👥 *Pengikut/Member:* ${members}\n`;
      text += `┃ 🔗 *Kode:* ${inviteCode}\n`;
      text += `┃ \n`;
      text += `> *Gunakan ID di atas untuk keperluan integrasi atau bot.*`;

      await new Button(conn)
        .setFooter(text)
        .addCopy("📋 Copy ID", targetId, { icon: "DOCUMENT" })
        .send(jid, { quoted: m });
    } catch (err) {
      console.error("Gagal mendapatkan ID:", err);
      await m.reply("Terjadi kesalahan saat memproses tautan.");
    }
  },
};