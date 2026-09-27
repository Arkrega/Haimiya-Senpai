import { getRuntimeValue, setRuntimeValue } from "../../utils/runtime.js";

export default {
  name: "Toggle Anti Delete",
  command: ["antidelete"],
  category: "owner",
  owner_only: true,
  async run(conn, m, { args, command, usedPrefix }) {
    const query = args[0]?.toLowerCase();
    const isAntidelete = getRuntimeValue("antidelete");

    if (query === "on") {
      if (isAntidelete === true) {
        await m.reply("Anti-Delete sudah dalam keadaan *ON*!");
        await m.react("✅");
      } else {
        setRuntimeValue("antidelete", true);
        await m.reply("Anti-Delete berhasil diaktifkan (*ON*)!");
        await m.react("✅");
      }
    } else if (query === "off") {
      if (isAntidelete === false) {
        await m.reply("Anti-Delete sudah dalam keadaan *OFF*!");
        await m.react("✅");
      } else {
        setRuntimeValue("antidelete", false);
        await m.reply("Anti-Delete berhasil dimatikan (*OFF*)!");
        await m.react("✅");
      }
    } else {
      await m.reply(
        `Format salah!\n\nContoh penggunaan:\n> ${usedPrefix + command} on\n> ${usedPrefix + command} off`
      );
      await m.react("❌");
    }
  }
};