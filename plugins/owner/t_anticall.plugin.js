import { getRuntimeValue, setRuntimeValue } from "../../utils/runtime.js";

export default {
  name: "Toggle Anti Call",
  command: ["anticall"],
  category: "owner",
  owner_only: true,
  async run(conn, m, { args, command, usedPrefix }) {
    const query = args[0]?.toLowerCase();
    const isAnticall = getRuntimeValue("anticall");

    if (!query) {
      await m.reply(`📞 Anti-Call: *${isAnticall ? "ON" : "OFF"}*\n\nGunakan ${usedPrefix + command} on/off untuk mengubahnya.`);
      return m.react("ℹ️");
    }

    if (query === "on" || query === "off") {
      const value = query === "on";
      setRuntimeValue("anticall", value);
      await m.reply(`Anti-Call berhasil ${value ? "diaktifkan" : "dimatikan"} (*${value ? "ON" : "OFF"}*).`);
      return m.react(value ? "✅" : "❌");
    }

    await m.reply(`Format salah!\n\nContoh:\n> ${usedPrefix + command} on\n> ${usedPrefix + command} off`);
    await m.react("❌");
  },
};
