import { getRuntimeValue, setRuntimeValue } from "../../utils/runtime.js";

export default {
  name: "Toggle Self",
  command: ["self"],
  category: "owner",
  owner_only: true,
  async run(conn, m, { args, command, usedPrefix }) {
    const query = args[0]?.toLowerCase();
    const isSelf = getRuntimeValue("self");

    if (query === "on") {
      if (isSelf === true) {
        await m.reply("Self mode sudah dalam keadaan *ON*!");
        await m.react("✅");
      } else {
        setRuntimeValue("self", true);
        await m.reply("Self mode berhasil diaktifkan (*ON*)!");
        await m.react("✅");
      }
    } else if (query === "off") {
      if (isSelf === false) {
        await m.reply("Self mode sudah dalam keadaan *OFF*!");
        await m.react("✅");
      } else {
        setRuntimeValue("self", false);
        await m.reply("Self mode berhasil dimatikan (*OFF*)!");
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