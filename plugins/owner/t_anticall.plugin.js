import { getRuntimeValue, setRuntimeValue } from "../../utils/runtime.js";

export default {
  name: "Toggle Anti Call",
  command: ["anticall"],
  category: "owner",
  owner_only: true,
  async run(conn, m, { args, command, usedPrefix }) {
    const query = args[0]?.toLowerCase();
    const isAnticall = getRuntimeValue("anticall");

    if (query === "on") {
      if (isAnticall === true) {
        await m.reply("Anti-Call sudah dalam keadaan *ON*!");
        await m.react("✅");
      } else {
        setRuntimeValue("anticall", true);
        await m.reply("Anti-Call berhasil diaktifkan (*ON*)!");
        await m.react("✅");
      }
    } else if (query === "off") {
      if (isAnticall === false) {
        await m.reply("Anti-Call sudah dalam keadaan *OFF*!");
        await m.react("✅");
      } else {
        setRuntimeValue("anticall", false);
        await m.reply("Anti-Call berhasil dimatikan (*OFF*)!");
        await m.react("✅");
      }
    } else {
      await m.reply(
        `Format salah!\n\nContoh penggunaan:\n> ${usedPrefix + command} on\n> ${usedPrefix + command} off`
      );
      await m.react("❌");
    }
  },
};