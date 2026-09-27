import { getRuntimeValue, setRuntimeValue } from "../../utils/runtime.js";

export default {
  name: "Toggle Auto Read",
  command: ["autoread"],
  category: "owner",
  owner_only: true,
  async run(conn, m, { args, command, usedPrefix }) {
    const query = args[0]?.toLowerCase();
    const autoRead = getRuntimeValue("auto_read");

    if (query === "on") {
      if (autoRead === true) {
        await m.reply("Auto Read sudah dalam keadaan *ON*!");
        await m.react("✅");
      } else {
        setRuntimeValue("auto_read", true);
        await m.reply("Auto Read berhasil diaktifkan (*ON*)!");
        await m.react("✅");
      }
    } else if (query === "off") {
      if (autoRead === false) {
        await m.reply("Auto Read sudah dalam keadaan *OFF*!");
        await m.react("✅");
      } else {
        setRuntimeValue("auto_read", false);
        await m.reply("Auto Read berhasil dimatikan (*OFF*)!");
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