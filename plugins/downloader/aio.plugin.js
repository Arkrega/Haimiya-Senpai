/* ═══════════════════════════════════════════════════════════════
   📥 [DOWNLOADER] MULTIDOWNLOADER — Fixed + AIRich/Button Upgrade
   ═══════════════════════════════════════════════════════════════ */

import axios from 'axios'
import yts from 'yt-search'
import scraper from '@zenaveline/scraper'
import crypto from 'crypto'
import { exec as _exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'

const execPromise = promisify(_exec)

/* ─────────────── HELPERS ─────────────── */

const SIZELIMIT = 50 * 1024 * 1024

function formatNumber(num = 0) {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toString()
}

function formatSize(bytes) {
  const s = ['B', 'KB', 'MB', 'GB']
  if (!bytes || bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + s[i]
}

function clean(s) { return String(s || '').trim() }
function cleanText(text = '') {
  return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
}

async function fetchHeadSize(url) {
  try {
    const head = await axios.head(url, { timeout: 15000 })
    return Number(head.headers['content-length'] || 0)
  } catch { return 0 }
}

/* ─────────────── API RESOLVER (biar gak stuck kalau global.APIs undefined) ─────────────── */

function getApi(name) {
  const apis = global.APIs || {}
  const map = {
    nexray: apis.nexray || 'https://api.nexray.eu.cc',
    faa:    apis.faa    || 'https://api-faa.my.id'
  }
  return map[name] || ''
}

/* ─────────────── MODE PARSER ─────────────── */

function parseMode(rawText) {
  const t = String(rawText || '').trim()
  const mPro = t.match(/(?:^|\s)-pro$/i)
  if (mPro) return { mode: 'pro', text: t.replace(/(?:^|\s)-pro$/i, '').trim() }
  const mLite = t.match(/(?:^|\s)-lite$/i)
  if (mLite) return { mode: 'lite', text: t.replace(/(?:^|\s)-lite$/i, '').trim() }
  return { mode: null, text: t }
}

/* ─────────────── AIRich / Button Loader ─────────────── */

async function getAIRich(conn) {
  if (global.AIRich) return new global.AIRich(conn)
  try {
    const mod = await import('../../utils/MessageBuilderV4.7.js')
    const Klass = mod.AIRich || mod.default?.AIRich
    if (Klass) return new Klass(conn)
  } catch (e) {
    console.warn('[MD] AIRich tidak tersedia:', e.message)
  }
  return null
}

async function getButton(conn) {
  try {
    const mod = await import('../../utils/MessageBuilderV4.7.js')
    return mod.Button || mod.default?.Button || null
  } catch { return null }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION: DOWNLOADER IMPLEMENTATIONS
   ═══════════════════════════════════════════════════════════════ */

/* ───────── AIO (nexray) — SUPPORT SEMUA LINK ───────── */
async function doAio(m, ctx, mode, text) {
  const { conn, jid } = ctx
  const chat = jid || m.chat

  if (!text) throw `Contoh:\n.aio https://vm.tiktok.com/ZSXwf1TAm/ -pro`

  await m.react('🕒')

  const base = getApi('nexray')
  if (!base) throw 'API nexray tidak terkonfigurasi di global.APIs'

  const res = await axios.get(`${base}/downloader/aio`, {
    params: { url: text },
    timeout: 45000
  })
  const json = res.data
  if (!json.status) throw new Error(json.message || 'Gagal mengambil media.')

  const data = json.result
  const media =
    data.medias.find(v => v.type === 'video' && v.quality === 'hd_no_watermark') ||
    data.medias.find(v => v.type === 'video') ||
    data.medias.find(v => v.type === 'audio')

  if (!media) throw 'Media tidak ditemukan.'

  const caption = `❏ Author   : ${data.author || '-'}\n❏ Duration : ${Math.floor((data.duration || 0) / 1000)} Detik\n❏ Title    : ${data.title || '-'}`

  /* ── MODE PRO: AIRich + Button ── */
  if (mode === 'pro') {
    const Rich = await getAIRich(conn)
    const Btn = await getButton(conn)

    if (Rich && Btn) {
      try {
        // Kirim preview + tombol aksi via AIRich
        const rich = Rich
          .setTitle('📥 All-in-One Downloader')
          .addText(caption)
          .addText(`\n📦 Ukuran: ${formatSize(media.data_size || 0)}`)
          .addSource([
            { name: 'NexRay API', url: 'https://api.nexray.eu.cc' }
          ])
          .addSuggest([
            'Ulangi',
            'Menu',
            'Owner'
          ])
          .setFooter('VIVY BOT MD')

        await rich.send(chat, { quoted: m })

        // Kirim Button untuk aksi cepat
        const btn = new Btn(conn)
          .setBody('Pilih aksi untuk media ini:')
          .setFooter('VIVY BOT MD')

        if (media.type === 'audio') {
          btn.addReply('🎵 Kirim Audio', `.aio ${text} -lite`)
        } else {
          btn.addReply('🎬 Kirim Video', `.aio ${text} -lite`)
          btn.addReply('🎵 Ambil Audio', `.aio ${text} -lite`)
        }
        btn.addUrl('🌐 Buka Source', media.url)
        btn.addReply('🔄 Ulangi', `.aio ${text} -pro`)

        await btn.send(chat, { quoted: m })
        await m.react('✅')
        return
      } catch (e) {
        console.error('[AIO PRO]', e)
        // fallback ke lite kalau AIRich/Button gagal
      }
    }

    // fallback: kirim media + caption
    if (media.type === 'audio') {
      await conn.sendMessage(chat, {
        audio: { url: media.url }, mimetype: 'audio/mpeg',
        fileName: `${data.title || 'audio'}.mp3`, ptt: false
      }, { quoted: m })
    } else {
      const isLarge = (media.data_size || 0) > SIZELIMIT
      if (isLarge) {
        await conn.sendMessage(chat, {
          document: { url: media.url }, fileName: `${data.title || 'video'}.mp4`,
          mimetype: 'video/mp4', caption
        }, { quoted: m })
      } else {
        await conn.sendMessage(chat, { video: { url: media.url }, caption }, { quoted: m })
      }
    }
    await m.react('✅')
    return
  }

  /* ── MODE LITE: media langsung ── */
  if (media.type === 'audio') {
    await conn.sendMessage(chat, {
      audio: { url: media.url }, mimetype: 'audio/mpeg',
      fileName: `${data.title || 'audio'}.mp3`, ptt: false
    }, { quoted: m })
  } else {
    const isLarge = (media.data_size || 0) > SIZELIMIT
    if (isLarge) {
      await conn.sendMessage(chat, {
        document: { url: media.url }, fileName: `${data.title || 'video'}.mp4`,
        mimetype: 'video/mp4', caption
      }, { quoted: m })
    } else {
      await conn.sendMessage(chat, { video: { url: media.url }, caption }, { quoted: m })
    }
  }
  await m.react('✅')
}

/* ───────── TIKTOK (ganti doTiktok lama) ───────── */
async function doTiktok(m, ctx, mode, text) {
  const { conn, jid } = ctx
  const chat = jid || m.chat
  await m.react('✨')

  const input = (m.quoted && m.quoted.text) ? m.quoted.text : text
  if (!input) throw `Contoh:\n.tt https://vt.tiktok.com/xxxx -pro\n.tt ryo yamada edit -lite`

  const { tiktokScrape } = await import('../../lib/scrape/tikwm.js')
  const isUrl = /^https?:\/\//i.test(input.trim())
  let res

  if (!isUrl) {
    const s = await searchTikTokNexray(input.trim())
    if (!s) throw 'Hasil pencarian tidak ditemukan'
    res = s.directData || await tiktokScrape(s.url)
  } else {
    res = await tiktokScrape(input.trim())
  }
  if (!res) throw 'Gagal mengambil data TikTok'

  const title = (res.title || '-').replace(/\s+/g, ' ').trim()
  const caption = `*\`TikTok Downloader\`*\n\n✿ *\`Judul\`* : ${title.length > 80 ? title.slice(0, 80) + '...' : title}\n✿ *\`Uploader\`* : ${res.author || '-'}`

  /* ── SLIDESHOW ── */
  if (res.type === 'image' && res.images?.length) {
    if (mode === 'pro') {
      const Rich = await getAIRich(conn)
      const Btn = await getButton(conn)

      if (Rich && Btn) {
        const rich = Rich
          .setTitle('🖼️ TikTok Photo Slide')
          .addText(caption)
          .addText(`\nTotal Foto: ${res.images.length}`)
        for (const [i, u] of res.images.entries()) {
          if (u) rich.addImage(u, { id: 'img_' + i })
        }
        await rich.send(chat, { quoted: m })

        const btn = new Btn(conn)
          .setBody('Aksi untuk slideshow ini:')
          .addReply('🎵 Ambil Musik', `.ttmusic ${input} -lite`)
          .addReply('🔄 Ulangi', `.tt ${input} -pro`)
          .addUrl('🌐 Buka TikTok', res.url || input)
          .setFooter('VIVY BOT MD')

        await btn.send(chat, { quoted: m })
        if (res.audio) {
          await conn.sendMessage(chat, { audio: { url: res.audio }, mimetype: 'audio/mpeg' }, { quoted: m })
        }
        await m.react('✅')
        return
      }
    }

    // fallback lite
    for (let i = 0; i < res.images.length; i++) {
      await conn.sendMessage(chat, {
        image: { url: res.images[i] }, caption: i === 0 ? caption : ''
      }, { quoted: m })
    }
    if (res.audio) {
      await conn.sendMessage(chat, { audio: { url: res.audio }, mimetype: 'audio/mpeg' }, { quoted: m })
    }
    await m.react('✅')
    return
  }

  /* ── VIDEO ── */
  if (res.video) {
    if (mode === 'pro') {
      const Btn = await getButton(conn)
      if (Btn) {
        const btn = new Btn(conn)
          .setMedia({ video: { url: res.video } })
          .setBody(caption)
          .addReply('🎵 Ambil Musik', `.ttmusic ${input} -lite`)
          .addReply('🔄 Ulangi', `.tt ${input} -pro`)
          .addUrl('🌐 Buka TikTok', res.url || input)
          .setFooter('VIVY BOT MD')
        await btn.send(chat, { quoted: m })
      } else {
        await conn.sendMessage(chat, { video: { url: res.video }, caption }, { quoted: m })
      }
    } else {
      await conn.sendMessage(chat, { video: { url: res.video }, caption }, { quoted: m })
    }

    if (res.audio) {
      await conn.sendMessage(chat, { audio: { url: res.audio }, mimetype: 'audio/mpeg' }, { quoted: m })
    }
    await m.react('✅')
    return
  }

  throw 'Media TikTok tidak ditemukan'
}

/* ───────── YTMP4 — upgrade AIRich ───────── */
async function doYtmp4(m, ctx, mode, text) {
  const { conn, jid, usedPrefix, command } = ctx
  const chat = jid || m.chat
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} https://youtube.com/watch?v=xxxx|720 -pro`)

  let [query, qualityInput = '360'] = text.split('|').map(s => s.trim())
  let url = query, durationSeconds = 0

  try {
    const search = await yts(query)
    const video = search.videos?.[0]
    if (video) {
      if (!/^https?:\/\//i.test(query)) url = video.url
      durationSeconds = video.seconds || 0
    } else if (!/^https?:\/\//i.test(query)) {
      return m.reply('Video tidak ditemukan.')
    }
  } catch {
    if (!/^https?:\/\//i.test(query)) return m.reply('Gagal mencari video.')
  }

  await m.react('🕒')
  const dl = await ytmp4Ripper.download(url, qualityInput)
  if (!dl.success) { await m.react('❌'); return m.reply(`Gagal: ${dl.message}`) }

  const { title, download_url, filesize, is60fps } = dl.data
  const fpsText = is60fps ? ' (60fps)' : ''
  const caption = `🎬 *${title}*\n⚙️ *Kualitas:* ${qualityInput}p${fpsText}\n⚖️ *Ukuran:* ${filesize || 'N/A'}`

  if (mode === 'pro') {
    const Btn = await getButton(conn)
    if (Btn) {
      const btn = new Btn(conn)
        .setMedia({ video: { url: download_url } })
        .setBody(caption)
        .addReply('🎵 Ambil MP3', `.ytmp3 ${url} -lite`)
        .addReply('🔄 Ulangi', `.ytmp4 ${text} -pro`)
        .addUrl('🌐 Buka YouTube', url)
        .setFooter('VIVY BOT MD')
      await btn.send(chat, { quoted: m })
      await m.react('✅')
      return
    }
  }

  await conn.sendMessage(chat, {
    video: { url: download_url }, mimetype: 'video/mp4',
    fileName: `${title}.mp4`, seconds: durationSeconds || undefined,
    caption
  }, { quoted: m })
  await m.react('✅')
}

/* ───────── SEARCH TIKTOK HELPER (dari kode lama) ───────── */
async function searchTikTokNexray(query) {
  const base = getApi('nexray')
  if (!base) return null
  try {
    const { data } = await axios.get(`${base}/search/tiktok`, {
      params: { q: query }, headers: { 'user-agent': 'Mozilla/5.0' }, timeout: 30000
    })
    if (!data?.status || !Array.isArray(data.result) || !data.result.length) return null
    const item = data.result.find(v => (v && v.id) || (v && v.data))
    if (!item) return null
    const authorNick = item.author?.nickname || 'user'
    const authorFull = item.author?.fullname || '-'
    const audioUrl = item.music_info?.url || null
    return {
      url: `https://www.tiktok.com/@${authorNick}/video/${item.id}`,
      directData: item.data ? {
        type: 'video', title: item.title || '-',
        author: authorNick !== 'user' ? authorNick : authorFull,
        video: item.data, images: [], audio: audioUrl
      } : null
    }
  } catch { return null }
}

/* ───────── YTMP4 RIPPER (dari kode lama, tetap) ───────── */
const YTMP4_CONFIG = {
  BASE_URL: 'https://ytb.rip',
  API_URL: 'https://ytb.rip/api/convert',
  CONFIG_TS: 1771534846328,
  HASH_SECRET: 'c7d6fe8b7a87fd4129f36353253e4696b7ca4768d84a5cf5a3432775758ad5d2',
  HEADERS: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
    Origin: 'https://ytb.rip', Referer: 'https://ytb.rip/'
  }
}

const ytmp4Ripper = {
  _gen: (url) => {
    const ts = Date.now()
    const hash = crypto.createHash('sha256').update(url + ts + YTMP4_CONFIG.HASH_SECRET).digest('hex')
    return { sf_url: url, ts: String(ts), _ts: String(YTMP4_CONFIG.CONFIG_TS), _tsc: '0', _s: hash }
  },
  _resolve: async (convUrl) => {
    const res = await axios.get(convUrl + '&popup=true', { headers: { ...YTMP4_CONFIG.HEADERS, Referer: 'https://ytb.rip/' } })
    const task = res.data?.task
    if (task?.status === 'finished' && task.downloadUrl) return task.downloadUrl
    const res2 = await axios.get(convUrl, { headers: { ...YTMP4_CONFIG.HEADERS, Referer: 'https://ytb.rip/' }, maxRedirects: 0, validateStatus: s => s < 400 })
    const loc = res2.headers?.location || ''
    const mLoc = loc.match(/[?&]t=([^&]+)/)
    const taskId = mLoc ? mLoc[1] : null
    if (taskId) {
      const sse = await axios.get(`https://du.sf-converter.com/tasks/${taskId}`, { headers: { Accept: 'text/event-stream', ...YTMP4_CONFIG.HEADERS, Referer: 'https://ytb.rip/' }, responseType: 'stream' })
      for await (const chunk of sse.data) {
        for (const line of new TextDecoder().decode(chunk).split('\n')) {
          if (line.startsWith('data: ')) {
            const evt = JSON.parse(line.slice(6))
            if (evt.status === 'finished' && evt.downloadUrl) return evt.downloadUrl
          }
        }
      }
    }
    if (loc.startsWith('http')) return loc
    throw new Error('Gagal dapat download URL')
  },
  download: async (videoUrl, quality) => {
    try {
      const res = await axios.post(YTMP4_CONFIG.API_URL,
        new URLSearchParams(ytmp4Ripper._gen(videoUrl)).toString(),
        { headers: { ...YTMP4_CONFIG.HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' } })
      const data = res.data
      if (!data?.url) return { success: false, message: 'Gagal mendapatkan data video' }
      const tq = String(quality).replace(/[^0-9]/g, '')
      const list = data.url.filter(u => (u.downloadable || u.isConverterUI) && !u.audio)
      const matches = list.filter(u => {
        const sub = String(u.subname || '').toLowerCase()
        const q = String(u.quality || '').toLowerCase()
        const n = String(u.name || '').toLowerCase()
        return sub.includes(tq) || q.includes(tq) || n.includes(tq)
      })
      if (!matches.length) return { success: false, message: `Kualitas ${quality}p tidak tersedia` }
      const m60 = matches.find(u => {
        const sub = String(u.subname || '').toLowerCase()
        const n = String(u.name || '').toLowerCase()
        const q = String(u.quality || '').toLowerCase()
        return sub.includes('60') || n.includes('60') || q.includes('60') || u.fps === 60
      })
      const sel = m60 || matches[0]
      let dlUrl = sel.url
      if (sel.isConverterUI) dlUrl = await ytmp4Ripper._resolve(dlUrl)
      const dMeta = data.meta || {}
      return {
        success: true,
        data: { title: dMeta.title, ext: 'mp4', filesize: sel.contentLength || sel.filesize || null, download_url: dlUrl, is60fps: !!m60 }
      }
    } catch (e) { return { success: false, message: e.message } }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION: DISPATCHER (hanya yang sudah diperbaiki)
   ═══════════════════════════════════════════════════════════════ */

const DISPATCH = {
  aio: doAio,
  tt: doTiktok, tiktok: doTiktok,
  ytmp4: doYtmp4, playvid: doYtmp4
}

/* ─────────────── MAIN HANDLER ─────────────── */

let handler = async (m, ctx) => {
  const { conn, text, args, usedPrefix, command, jid } = ctx

  // ⚠️ JANGAN attach listener di sini — lakukan sekali di index.js
  // attachLiteListener(conn)  ← pindahkan ke file utama

  const parsed = parseMode(text)
  const mode = parsed.mode
  const cleanText = parsed.text
  const cleanArgs = cleanText ? cleanText.split(/\s+/) : []

  if (!mode) {
    return m.reply(
      `⚠️ *WAJIB* tambahkan suffix:\n\n` +
      `• *-pro*  → AIRich + Button\n` +
      `• *-lite* → media langsung\n\n` +
      `Contoh:\n${usedPrefix}${command} https://... -pro`
    )
  }

  const fn = DISPATCH[command.toLowerCase()]
  if (!fn) throw new Error(`Downloader "${command}" belum di-support di versi ini.`)

  try {
    await fn(m, { ...ctx, jid: jid || m.chat, args: cleanArgs, text: cleanText }, mode, cleanText)
  } catch (e) {
    console.error(`[${command.toUpperCase()} ERROR]`, e)
    try { await m.react('❌') } catch {}
    throw (typeof e === 'string') ? e : (e?.message || 'Terjadi kesalahan.')
  }
}

handler.help = ['aio', 'tt', 'ytmp4'].map(v => v + ' <url/query> -pro|-lite')
handler.tags = ['downloader']
handler.command = /^(aio|tt|tiktok|ytmp4|playvid)$/i
handler.limit = true

export default handler