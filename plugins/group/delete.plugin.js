export default {
  name: "Delete Message",
  command: ["del", "delete", "d"],
  category: "tools",
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Menghapus pesan bot atau pesan member",
  async run(conn, m, { jid, quotedKey, isBotAdmin, isAdmin, isOwner }) {
    if (!quotedKey) {
      return await m.reply("Reply pesan yang ingin dihapus!");
    }

    if (!quotedKey.fromMe) {
      if (!m.isGroup) {
        return await m.reply("Tidak bisa menghapus pesan orang lain di private chat.");
      }
      if (!isBotAdmin) {
        return await m.reply("Bot harus menjadi admin untuk menghapus pesan member.");
      }
      if (!isAdmin && !isOwner) {
        return await m.reply("Hanya Admin atau Owner yang bisa menghapus pesan member.");
      }
    }

    try {
      await conn.sendMessage(jid, { delete: quotedKey });
    } catch (error) {
      await m.reply("Gagal menghapus pesan.");
    }
  }
};