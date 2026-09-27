export default {
  name: "Promote",
  command: ["promote"],
  owner_only: false,
  private_only: false,
  group_only: true,
  category: "group",
  async run(conn, m, { jid, args, isAdmin, isBotAdmin, isOwner, quotedSender, mentionedJid }) {
    if (!isAdmin && !isOwner) {
      return await m.reply("Fitur ini hanya untuk admin grup.");
    }
    if (!isBotAdmin) {
      return await m.reply("Bot harus menjadi admin terlebih dahulu.");
    }

    let targetJid = quotedSender || (mentionedJid && mentionedJid[0]) || (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);

    if (!targetJid || !targetJid.endsWith("@s.whatsapp.net")) {
      return await m.reply("Tag anggota atau balas pesannya yang ingin dijadikan admin!\nContoh: .promote @user");
    }

    try {
      await conn.groupParticipantsUpdate(jid, [targetJid], "promote");
      await conn.sendMessage(jid, { text: `🎉 Selamat! *@${targetJid.split("@")[0]}* telah diangkat menjadi *Admin Grup*!`, mentions: [targetJid] }, { quoted: m });
      await m.react("👑");
    } catch (e) {
      await m.react("❌");
      await m.reply("Gagal menaikkan jabatan anggota menjadi Admin.");
    }
  }
};