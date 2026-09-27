export default {
  name: "Out",
  command: ["out"],
  owner_only: true,
  private_only: false,
  group_only: true,
  category: "group",
  async run(conn, m, { jid }) {
    try {
      await m.reply("Sayonara!");
      await conn.groupLeave(jid);
    } catch (e) {
      await m.reply("Gagal keluar dari grup");
    }
  }
};