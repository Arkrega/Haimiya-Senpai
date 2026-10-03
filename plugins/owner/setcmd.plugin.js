import { getStickerDB, saveStickerDB, getReactDB, saveReactDB } from "../../utils/cmd_db.js";

export default {
  name: "Dynamic Command Setter",
  command: ["setcmd", "delcmd", "setreact", "delreact"],
  category: "owner",
  owner_only: true,
  private_only: false,
  group_only: false,
  description: "Mengatur Stiker dan Reaksi sebagai command",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    if (command === "setcmd" || command === "delcmd") {
      const isSticker = m.quotedMessage?.stickerMessage;
      if (!isSticker) return await m.reply("Reply stikernya!");
      
      const hash = Buffer.from(m.quotedMessage.stickerMessage.fileSha256).toString("base64");
      const db = getStickerDB();

      if (command === "setcmd") {
        const cmdText = args.join(" ");
        if (!cmdText) return await m.reply(`Teks command wajib!\nContoh: ${usedPrefix}setcmd menu`);
        db[hash] = cmdText;
        saveStickerDB(db);
        await m.reply(`Stiker berhasil diset menjadi command: *${cmdText}*`);
      } else {
        if (!db[hash]) return await m.reply("Stiker ini belum pernah dijadikan command.");
        delete db[hash];
        saveStickerDB(db);
        await m.reply("Command dari stiker ini berhasil dihapus.");
      }
    }

    if (command === "setreact" || command === "delreact") {
      const db = getReactDB();
      const emoji = args[0];

      if (command === "setreact") {
        const action = args[1];
        if (!emoji || !action || !["kick", "delete", "del"].includes(action.toLowerCase())) {
          return await m.reply(`Format salah!\nContoh: ${usedPrefix}setreact 🚫 kick\nAction tersedia: kick, delete`);
        }
        db[emoji] = action.toLowerCase();
        saveReactDB(db);
        await m.reply(`Reaksi ${emoji} diset untuk aksi: *${action}*`);
      } else {
        if (!emoji) return await m.reply(`Masukkan emoji!\nContoh: ${usedPrefix}delreact 🚫`);
        if (!db[emoji]) return await m.reply("Reaksi ini belum diset.");
        delete db[emoji];
        saveReactDB(db);
        await m.reply(`Aksi untuk reaksi ${emoji} berhasil dihapus.`);
      }
    }
  }
};