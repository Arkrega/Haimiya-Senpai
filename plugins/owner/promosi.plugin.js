import { Button } from "../../utils/MessageBuilderV4.7.js";

export default {
  name: "Promo SPPG",
  command: ["promosppg"],
  owner_only: true,
  private_only: false,
  group_only: false,
  category: "owner",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    if (args[0] === "kontak") {
      const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:Big Yahu\nORG:SPPG Tel Aviv;\nTEL;type=CELL;type=VOICE;waid=972544700047:+972 54-470-0047\nEND:VCARD';
      return await conn.sendMessage(jid, {
        contacts: {
          displayName: 'Big Yahu',
          contacts: [{ vcard }]
        }
      }, { quoted: m });
    }

    const targets = [];
    if (args.length > 0) {
      for (const arg of args) {
        let targetJid = arg.trim();
        if (targetJid.includes("@g.us") || targetJid.includes("@s.whatsapp.net")) {
          targets.push(targetJid);
        } else {
          const number = targetJid.replace(/[^0-9]/g, "");
          if (number.length > 5) {
            targets.push(`${number}@s.whatsapp.net`);
          }
        }
      }
    }

    if (targets.length === 0) {
      targets.push(jid);
    }

    const imgUrl = "https://raw.githubusercontent.com/ArkRega/Kumpulan-Skin-/main/uploads/upload-1790688107053.jpg";
    const caption = "Telah resmi dibuka lowongan kerja SPPG Tel Aviv\n\nDibutuhkan segera untuk posisi\n- supir\n- staff cuci ompreng\n\nKualifikasi:\n- Lulusan SMA/K\n- Usia minimal 18\n- memiliki sim (untuk mengisi posisi supir)\n- bisa bahasa Ibrani\n- goyim diperbolehkan mendaftar wajib memiliki kartu tanda goyim\n\nGaji 765 shakels perbulan\n\nJika minat segera hubungi big yahu";
    const waText = encodeURIComponent("Shalom Big Yahu, saya berminat melamar lowongan kerja di SPPG Tel Aviv 😀");
    const waUrl = `https://wa.me/972544700047?text=${waText}`;

    await m.react("⏳");

    for (const target of targets) {
      try {
        await new Button(conn)
          .setImage(imgUrl)
          .setBody(caption)
          .setFooter("SPPG Tel Aviv")
          .addUrl("Hubungi Big Yahu", waUrl)
          .addReply("Info Kontak", `${usedPrefix}${command} kontak`)
          .send(target);
        await new Promise(r => setTimeout(r, 2500));
      } catch (error) {
        console.error(error);
      }
    }

    if (targets.length > 1 || targets[0] !== jid) {
        await m.reply(`Berhasil mengirim pesan promosi ke ${targets.length} target.`);
    }
    await m.react("✅");
  }
};