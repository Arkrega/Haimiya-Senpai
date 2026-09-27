import { addAfk } from "../../utils/afk.js";

export default {
  name: "Set AFK",
  command: ["afk"],
  owner_only: false,
  private_only: false,
  group_only: false,
  category: "main",
  async run(conn, m, { senderJid, args, pushName }) {
    const reason = args.join(" ") || "Tanpa alasan";
    addAfk(senderJid, reason);
    await m.reply(`💤 *${pushName}* sekarang AFK.\n\n📝 Alasan: ${reason}`);
  }
};