import { addAfk } from "../../utils/afk.js";

export default {
  name: "Set AFK",
  command: ["afk"],
  owner_only: true,
  private_only: false,
  group_only: false,
  category: "main",
  async run(conn, m, { senderJid, args }) {
    const reason = args.join(" ") || "Sedang sibuk";
    addAfk(senderJid, reason);
    await m.reply(`💤 *Sedang AFK!!*\n\nSaya sekarang sedang AFK.\n📝 Alasan: ${reason}\n\n_Mohon Tinggalkan pesan agar dibaca setelah ${reason} selesai_`);
  }
};