import { getGroupData, updateGroupData } from "../../utils/database.js";
import { Button } from "../../utils/MessageBuilderV4.7.js";

export default {
  name: "Group Settings",
  command: ["setting", "group_setting"],
  category: "group",
  group_only: true,
  async run(conn, m, { jid, args, isAdmin, isOwner, usedPrefix, command, mentionedJid }) {
    if (!isAdmin && !isOwner) return await m.reply("Khusus admin.");

    const action = args[0]?.toLowerCase();
    const target = args[1]?.toLowerCase();
    const val = args.slice(2).join(" ");

    const db = getGroupData(jid);

    if (action === "toggle") {
      const current = db[target];
      updateGroupData(jid, target, !current);
      return await m.reply(`Berhasil mengubah ${target} menjadi ${!current}`);
    }

    if (action === "action") {
      if (["warn", "delete", "kick", "mute"].includes(target)) {
        updateGroupData(jid, "action", target);
        return await m.reply(`Berhasil mengubah aksi pelanggaran menjadi: ${target}`);
      }
    }

    if (action === "maxwarn") {
      const num = parseInt(target);
      if (num > 0) {
        updateGroupData(jid, "max_warn", num);
        return await m.reply(`Berhasil mengubah batas peringatan menjadi: ${num}`);
      }
    }

    if (action === "whitelist_domain") {
      if (target === "add" && val) {
        const list = db.whitelist_domains;
        if (!list.includes(val)) list.push(val);
        updateGroupData(jid, "whitelist_domains", list);
        return await m.reply(`Berhasil menambahkan ${val} ke whitelist domain.`);
      }
      if (target === "remove" && val) {
        const list = db.whitelist_domains.filter((d) => d !== val);
        updateGroupData(jid, "whitelist_domains", list);
        return await m.reply(`Berhasil menghapus ${val} dari whitelist domain.`);
      }
    }

    if (action === "whitelist_user") {
      if (target === "add" && mentionedJid.length > 0) {
        const list = db.whitelist_users;
        for (const user of mentionedJid) {
          if (!list.includes(user)) list.push(user);
        }
        updateGroupData(jid, "whitelist_users", list);
        return await m.reply(`Berhasil menambahkan user ke whitelist.`);
      }
      if (target === "remove" && mentionedJid.length > 0) {
        const list = db.whitelist_users.filter((u) => !mentionedJid.includes(u));
        updateGroupData(jid, "whitelist_users", list);
        return await m.reply(`Berhasil menghapus user dari whitelist.`);
      }
    }

    const txt = `*GROUP SETTINGS*\n\nStatus Fitur saat ini:\n` +
      `• Anti-Link WA: ${db.antilink_wa ? "✅" : "❌"}\n` +
      `• Anti-Link TG: ${db.antilink_tg ? "✅" : "❌"}\n` +
      `• Anti-Link Discord: ${db.antilink_dc ? "✅" : "❌"}\n` +
      `• Anti-Link YT/TikTok: ${db.antilink_yt_tt ? "✅" : "❌"}\n` +
      `• Anti-Spam Pesan: ${db.antispam ? "✅" : "❌"}\n` +
      `• Anti-Spam Sticker: ${db.antisticker ? "✅" : "❌"}\n` +
      `• Anti-Bot: ${db.antibot ? "✅" : "❌"}\n` +
      `• Aksi Pelanggaran: *${db.action.toUpperCase()}*\n` +
      `• Max Warn: *${db.max_warn}*\n\n` +
      `Whitelist Domain: ${db.whitelist_domains.join(", ") || "-"}\n` +
      `Whitelist User: ${db.whitelist_users.length} User\n\n` +
      `Cara manual:\n` +
      `${usedPrefix}${command} whitelist_domain add namadomain.com\n` +
      `${usedPrefix}${command} whitelist_user add @user\n\n` +
      `Atau pilih pengaturan cepat di bawah ini:`;

    const builder = new Button(conn)
      .setTitle("Pengaturan Grup")
      .setBody(txt)
      .addSelection("Ubah Pengaturan");

    builder.makeSection("Toggle Anti-Link", "");
    builder.makeRow("", "Anti-Link WA", "", `${usedPrefix}${command} toggle antilink_wa`);
    builder.makeRow("", "Anti-Link Telegram", "", `${usedPrefix}${command} toggle antilink_tg`);
    builder.makeRow("", "Anti-Link Discord", "", `${usedPrefix}${command} toggle antilink_dc`);
    builder.makeRow("", "Anti-Link YT & TikTok", "", `${usedPrefix}${command} toggle antilink_yt_tt`);

    builder.makeSection("Toggle Moderasi", "");
    builder.makeRow("", "Anti-Spam Pesan", "", `${usedPrefix}${command} toggle antispam`);
    builder.makeRow("", "Anti-Spam Sticker", "", `${usedPrefix}${command} toggle antisticker`);
    builder.makeRow("", "Anti-Bot (Auto Kick)", "", `${usedPrefix}${command} toggle antibot`);

    builder.makeSection("Aksi Pelanggaran", "");
    builder.makeRow("", "Aksi: Warn", "Hapus + Tambah Peringatan", `${usedPrefix}${command} action warn`);
    builder.makeRow("", "Aksi: Delete", "Hanya hapus pesan", `${usedPrefix}${command} action delete`);
    builder.makeRow("", "Aksi: Kick", "Hapus pesan + Kick langsung", `${usedPrefix}${command} action kick`);
    builder.makeRow("", "Aksi: Mute", "Hapus pesan + Auto hapus chat user", `${usedPrefix}${command} action mute`);

    await builder.send(jid, { quoted: m });
  }
};