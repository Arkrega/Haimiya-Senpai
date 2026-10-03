import {
  createBackup,
  disableBackup,
  formatInterval,
  getBackupStatus,
  parseInterval,
  setBackupConfig,
  startAutoBackup,
} from "../../utils/backup.js";

export default {
  name: "Backup System",
  command: ["backup", "setbackup"],
  category: "owner",
  owner_only: true,

  async run(conn, m, { args, command, usedPrefix }) {
    const query = args[0]?.toLowerCase();

    if (!query || query === "status") {
      const status = getBackupStatus();
      const last = status.lastRun
        ? new Date(status.lastRun).toLocaleString("id-ID")
        : "Belum pernah";

      return m.reply(
        `📦 *BACKUP SYSTEM*\n\n` +
        `Status: *${status.enabled ? "AKTIF" : "OFF"}*\n` +
        `Interval: *${formatInterval(status.interval)}*\n` +
        `Backup terakhir: *${last}*\n\n` +
        `Contoh:\n` +
        `> ${usedPrefix}backup 6h\n` +
        `> ${usedPrefix}backup 1d\n` +
        `> ${usedPrefix}backup now\n` +
        `> ${usedPrefix}backup off`
      );
    }

    if (query === "off") {
      disableBackup();
      startAutoBackup(conn);
      await m.reply("📦 Auto Backup berhasil dimatikan.");
      return m.react("✅");
    }

    if (query === "now") {
      await m.reply("📦 Membuat backup sekarang...");
      try {
        const fileName = await createBackup(conn);
        await m.react("✅");
        return m.reply(`Backup berhasil dibuat dan dikirim ke owner.\n📁 ${fileName}`);
      } catch (error) {
        await m.react("❌");
        return m.reply(`Gagal membuat backup: ${error.message}`);
      }
    }

    const interval = parseInterval(query);
    if (!interval) {
      await m.reply(
        `Format interval salah. Minimal 1 menit.\n\n` +
        `Contoh:\n` +
        `> ${usedPrefix}backup 30m\n` +
        `> ${usedPrefix}backup 6h\n` +
        `> ${usedPrefix}backup 1d\n` +
        `> ${usedPrefix}backup 1w`
      );
      return m.react("❌");
    }

    setBackupConfig(interval);
    startAutoBackup(conn);
    await m.reply(`📦 Auto Backup aktif.\n⏱️ Interval: *${formatInterval(interval)}*\n📨 Backup otomatis akan dikirim ke owner.`);
    return m.react("✅");
  },
};
