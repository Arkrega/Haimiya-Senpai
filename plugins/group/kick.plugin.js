export default {
  name: "Kick",
  command: ["kick", "dor"],
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

    if (!targetJid) {
      return await m.reply("Tag member atau balas pesan yang ingin dikick");
    }

    try {
      await conn.groupParticipantsUpdate(jid, [targetJid], "remove");
      await m.react("✅");
    } catch (e) {
      await m.react("❌");
      await m.reply("Gagal mengeluarkan anggota.");
    }
  }
};