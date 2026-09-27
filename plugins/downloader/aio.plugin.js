import axios from 'axios'
import * as cheerio from 'cheerio'
import FormData from 'form-data'
import fetch from 'node-fetch'
import yts from 'yt-search'
import scraper from '@zenaveline/scraper'
import crypto from 'crypto'
import { exec as _exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { AIRich, Button, Carousel } from '../../utils/MessageBuilderV4.7.js'

const execPromise = promisify(_exec)

const pendingLite = global._mdPendingLite || (global._mdPendingLite = new Map())
let _listenerAttached = global._mdListenerAttached || false

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
    const head = await fetch(url, { method: 'HEAD' })
    return Number(head.headers.get('content-length') || 0)
  } catch { return 0 }
}

const SIZELIMIT = 50 * 1024 * 1024

function attachLiteListener(conn) {
  if (_listenerAttached) return
  _listenerAttached = true
  global._mdListenerAttached = true

  conn.ev.on('messages.upsert', async (ev) => {
    try {
      const msgs = ev.messages || []
      for (const msg of msgs) {
        if (!msg || !msg.message) continue
        const extended = msg.message.extendedTextMessage
        const ctxInfo = extended ? extended.contextInfo : null
        const quotedId = ctxInfo ? ctxInfo.stanzaId : null
        if (!quotedId) continue
        
        const entry = pendingLite.get(quotedId)
        if (!entry) continue

        const txt = (msg.message.conversation ||
          (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) ||
          (msg.message.buttonsResponseMessage && msg.message.buttonsResponseMessage.selectedButtonId) ||
          '').trim()

        const idx = parseInt(txt, 10) - 1
        if (isNaN(idx) || idx < 0 || idx >= entry.options.length) continue

        const chosen = entry.options[idx]
        pendingLite.delete(quotedId)

        try {
          await conn.sendMessage(msg.key.remoteJid, { text: `⏳ Memproses *${chosen.label}*...` })
          await chosen.run()
        } catch (e) {
          const errText = (e && e.message) ? e.message : e
          await conn.sendMessage(msg.key.remoteJid, { text: `❌ ${errText}` })
        }
      }
    } catch (e) {
      console.error('[MD LITE LISTENER]', e)
    }
  })
}

async function doAio(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) throw `Contoh:\n${usedPrefix}${command} https://vm.tiktok.com/ZSXwf1TAm/`
  await m.react('🕒')
  const res = await fetch(`${global.APIs.nexray}/downloader/aio?url=${encodeURIComponent(text)}`)
  const json = await res.json()
  if (!json.status) throw new Error(json.message || 'Gagal mengambil media.')
  const data = json.result
  const media = data.medias.find(v => v.type === 'video' && v.quality === 'hd_no_watermark')
    || data.medias.find(v => v.type === 'video')
    || data.medias.find(v => v.type === 'audio')
  if (!media) throw 'Media tidak ditemukan.'

  const caption = `❏ Author   : ${data.author || '-'}\n❏ Duration : ${Math.floor((data.duration || 0) / 1000)} Detik\n❏ Title    : ${data.title || '-'}`

  if (media.type === 'audio') {
    await new Button(conn)
      .setBody(caption)
      .setMedia({ audio: { url: media.url } })
      .send(m.chat, { quoted: m })
  } else {
    const isLarge = (media.data_size || 0) > SIZELIMIT
    if (isLarge) {
      await conn.sendMessage(m.chat, {
        document: { url: media.url }, fileName: `${data.title || 'video'}.mp4`,
        mimetype: 'video/mp4', caption
      }, { quoted: m })
    } else {
      await new Button(conn)
        .setMedia({ video: { url: media.url } })
        .setBody(caption)
        .send(m.chat, { quoted: m })
    }
  }
  await m.react('✅')
}

async function doAio2(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Example : ${usedPrefix + command} https://vt.tiktok.com/xxxx`)
  await m.react('✨')
  const api = `${global.APIs.faa}/faa/aio?url=${encodeURIComponent(text)}`
  const res = await fetch(api)
  const json = await res.json()
  if (!json.status) throw 'Gagal mengambil data.'
  await new Button(conn)
    .setMedia({ video: { url: json.result.download_url } })
    .setBody(json.result.title || 'Video berhasil diunduh')
    .send(m.chat, { quoted: m })
  await m.react('✅')
}

async function doAppleMusic(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} Genit\n${usedPrefix + command} https://music.apple.com/...`)
  await m.react('🕒')
  let url = text
  if (!/^https?:\/\/music\.apple\.com/i.test(text)) {
    const s = await (await fetch(`${global.APIs.nexray}/search/applemusic?q=${encodeURIComponent(text)}`)).json()
    if (!s || !s.status || !s.result || !s.result.length) { await m.react('❌'); return m.reply('❌ Lagu tidak ditemukan.') }
    const song = s.result.find(v => /^Song/i.test(v.subtitle)) || s.result[0]
    url = song.link
  }
  const data = await (await fetch(`${global.APIs.nexray}/downloader/applemusic?url=${encodeURIComponent(url)}`)).json()
  if (!data || !data.status) { await m.react('❌'); return m.reply('❌ Gagal mengambil audio.') }
  const r = data.result
  const caption = `   *Apple Music Downloader*\n\n✿ Title : ${r.name}\n✿ Artist : ${r.artist}\n✿ Album : ${r.album_name}\n✿ Type : ${r.type}\n✿ Duration : ${r.duration || '-'}`
  
  await new Button(conn)
    .setImage(r.thumbnail)
    .setBody(caption)
    .send(m.chat, { quoted: m })
    
  await conn.sendMessage(m.chat, {
    audio: { url: r.url }, mimetype: 'audio/mpeg', fileName: `${r.name}.mp3`
  }, { quoted: m })
  await m.react('✅')
}

async function bilibiliDl(url, quality = '480P') {
  const aidMatch = /\/video\/(\d+)/.exec(url)
  const aid = aidMatch ? aidMatch[1] : null
  if (!aid) throw new Error('ID Video tidak ditemukan')
  const html = await axios.get(url).then(r => r.data)
  const $ = cheerio.load(html)
  const ogTitle = $('meta[property="og:title"]').attr('content')
  const title = ogTitle ? ogTitle.split('|')[0].trim() : ''
  const description = $('meta[property="og:description"]').attr('content')
  const type = $('meta[property="og:video:type"]').attr('content')
  const cover = $('meta[property="og:image"]').attr('content')
  const like = $('.interactive__btn.interactive__like .interactive__text').text()
  const views = $('.bstar-meta__tips-left .bstar-meta-text').first().text().replace(' Ditonton', '')

  const response = await axios.get('https://api.bilibili.tv/intl/gateway/web/playurl', {
    params: {
      s_locale: 'id_ID', platform: 'web', aid, qn: '64', type: '0',
      device: 'wap', tf: '0', spm_id: 'bstar-web.ugc-video-detail.0.0',
      from_spm_id: 'bstar-web.homepage.trending.all', fnval: '16', fnver: '0'
    }
  }).then(r => r.data)

  const sel = response.data.playurl.video.find(v => v.stream_info.desc_words === quality)
  if (!sel) throw new Error('Video tidak ditemukan dengan kualitas itu')
  const videoUrl = sel.video_resource.url || sel.video_resource.backup_url[0]
  const audioUrl = response.data.playurl.audio_resource[0].url || response.data.playurl.audio_resource[0].backup_url[0]

  async function downloadBuffer(u) {
    const buffers = []
    let start = 0, end = 5 * 1024 * 1024 - 1, fileSize = 0
    while (true) {
      const r = await axios.get(u, {
        headers: {
          DNT: '1', Origin: 'https://www.bilibili.tv',
          Referer: 'https://www.bilibili.tv/video/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Range: `bytes=${start}-${end}`
        },
        responseType: 'arraybuffer'
      })
      if (fileSize === 0) {
        const cr = r.headers['content-range']
        if (cr) fileSize = parseInt(cr.split('/')[1])
      }
      buffers.push(Buffer.from(r.data))
      if (end >= fileSize - 1) break
      start = end + 1
      end = Math.min(start + 5 * 1024 * 1024 - 1, fileSize - 1)
    }
    return Buffer.concat(buffers)
  }

  const vb = await downloadBuffer(videoUrl)
  const ab = await downloadBuffer(audioUrl)
  const tmpV = `temp_v_${Date.now()}.mp4`
  const tmpA = `temp_a_${Date.now()}.mp3`
  const tmpO = `temp_o_${Date.now()}.mp4`
  await fsp.writeFile(tmpV, vb)
  await fsp.writeFile(tmpA, ab)
  await execPromise(`ffmpeg -i "${tmpV}" -i "${tmpA}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -f mp4 "${tmpO}"`)
  const merged = await fsp.readFile(tmpO)
  await Promise.all([fsp.unlink(tmpV), fsp.unlink(tmpA), fsp.unlink(tmpO)].map(p => p.catch(() => {})))
  return { title, description, type, cover, views, like, videoBuffer: merged }
}

async function doBilibili(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) throw `Contoh: ${usedPrefix + command} https://www.bilibili.tv/video/4793817472438784`
  m.reply('✨ wait...')
  const result = await bilibiliDl(text, '480P')
  
  await new Button(conn)
    .setMedia({ video: result.videoBuffer })
    .setBody(`🎬 *${result.title}*\n📝 ${result.description}\n👀 ${result.views} tayangan | ❤️ ${result.like}`)
    .send(m.chat, { quoted: m })
}

async function doCapcut(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) throw `Contoh:\n${usedPrefix}${command} https://www.capcut.com/tv2/ZSC3H1kDM/`
  await m.react('🕒')
  const json = await (await fetch(`${global.APIs.nexray}/downloader/capcut?url=${encodeURIComponent(text)}`)).json()
  if (!json.status) throw new Error(json.message || 'Gagal mengambil video.')
  const data = json.result
  const size = await fetchHeadSize(data.url)
  const isLarge = size > SIZELIMIT
  const caption = `❏ Author : ${data.author || '-'}\n❏ Title  : ${data.title || '-'}`
  if (isLarge) {
    await conn.sendMessage(m.chat, {
      document: { url: data.url }, fileName: `${data.title || 'capcut'}.mp4`,
      mimetype: 'video/mp4', caption
    }, { quoted: m })
  } else {
    await new Button(conn)
      .setMedia({ video: { url: data.url } })
      .setBody(caption)
      .send(m.chat, { quoted: m })
  }
  await m.react('✅')
}

async function doDouyin(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Masukkan link Douyin!\n\nContoh:\n${usedPrefix}${command} https://v.douyin.com/xxxxx`)
  const json = await (await fetch(`https://api-faa.my.id/faa/douyin-down?url=${encodeURIComponent(text)}`)).json()
  if (!json.status || !json.result) throw 'Gagal mengambil data Douyin'
  const data = json.result
  const video = (data.medias || []).find(v => v.type === 'video')
  if (!video || !video.url) return m.reply('Video tidak ditemukan')
  const caption = `✨ *DOUYIN DOWNLOADER*\n\n📌 *Judul:* ${data.title || '-'}`
  
  await new Button(conn)
    .setMedia({ video: { url: video.url } })
    .setBody(caption)
    .send(m.chat, { quoted: m })
}

async function fbGetToken() {
  const { data: html } = await axios.get('https://fbdownloader.to/id', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7' }
  })
  const m = html.match(/k_exp="(.*?)".*?k_token="(.*?)"/s)
  if (!m) throw new Error('Token tidak ditemukan')
  return { k_exp: m[1], k_token: m[2] }
}

async function fbDl(url) {
  const { k_exp, k_token } = await fbGetToken()
  const payload = new URLSearchParams({ k_exp, k_token, p: 'home', q: url, lang: 'id', v: 'v2', W: '' })
  const { data } = await axios.post('https://fbdownloader.to/api/ajaxSearch', payload, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest',
      Origin: 'https://fbdownloader.to', Referer: 'https://fbdownloader.to/id'
    }
  })
  if (!data || !data.data) throw new Error('Gagal mengambil data video')
  const results = []
  const regex = /<td class="video-quality">(.*?)<\/td>[\s\S]*?(?:href="(.*?)"|data-videourl="(.*?)")/g
  let match
  while ((match = regex.exec(data.data)) !== null) {
    const q = match[1].trim(); const u = match[2] || match[3]
    if (q && u) results.push({ quality: q, url: u })
  }
  return results
}

async function doFacebook(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Masukkan link Facebook, contoh:\n${usedPrefix}${command} https://facebook.com/...`)
  const results = await fbDl(text)
  if (!results.length) return m.reply('❌ Tidak ada video ditemukan.')
  const videoUrl = results[0].url
  const buf = (await axios.get(videoUrl, { responseType: 'arraybuffer' })).data
  
  await new Button(conn)
    .setMedia({ video: Buffer.from(buf) })
    .setBody(`📥 Facebook Downloader\nKualitas: ${results[0].quality}`)
    .send(m.chat, { quoted: m })
}

async function doGitclone(m, ctx, text, args) {
  const { conn, usedPrefix, command } = ctx
  const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i
  const url = (args && args[0]) ? args[0] : text
  if (!url) throw `Example user ${usedPrefix}${command} https://github.com/ImYanXiao/Elaina-MultiDevice`
  if (!regex.test(url)) throw 'Url Tidak Valid!'
  let [_, user, repo] = url.match(regex) || []
  repo = repo.replace(/\.git$/, '')
  const dlUrl = `https://api.github.com/repos/${user}/${repo}/zipball`
  const filename = (await fetch(dlUrl, { method: 'HEAD' })).headers.get('content-disposition').match(/attachment; filename=(.*)/)[1]
  m.reply('D o w n l o a d i n g. . .')
  conn.sendFile(m.chat, dlUrl, filename, null, m)
}

async function doGdrive(m, ctx, text, args) {
  const { conn, usedPrefix, command } = ctx
  const url = (args && args[0]) ? args[0] : text
  if (!url) throw `Contoh: ${usedPrefix + command} https://drive.google.com/file/d/xxxx/view`
  const match = url.match(/\/d\/([^/]+)|open\?id=([^&]+)/)
  const fileId = match ? (match[1] || match[2]) : null
  if (!fileId) throw 'URL Google Drive tidak valid!'
  const apiKey = 'AIzaSyAA9ERw-9LZVEohRYtCWka_TQc6oXmvcVU'
  const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,size,mimeType&key=${apiKey}`
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`
  const metadata = (await axios.get(metaUrl)).data
  const { name, size, mimeType } = metadata
  m.reply(`Mendownload file...\n\n• Nama: ${name}\n• Ukuran: ${formatSize(Number(size))}\n• Tipe: ${mimeType}`)
  const res = await axios.get(downloadUrl, { responseType: 'arraybuffer' })
  if (res.status !== 200) throw `Gagal mengunduh file: ${res.status}`
  const buffer = Buffer.from(res.data, 'binary')
  const tmpPath = path.join(os.tmpdir(), name)
  fs.writeFileSync(tmpPath, buffer)
  await conn.sendMessage(m.chat, {
    document: { url: tmpPath }, fileName: name,
    mimetype: mimeType || 'application/octet-stream',
    caption: `File berhasil diunduh!\n\n• Nama: ${name}\n• Ukuran: ${formatSize(Number(size))}`
  }, { quoted: m })
}

async function igDl(url, m) {
  m.reply('Wait')
  const form = new FormData()
  form.append('url', url)
  form.append('action', 'post')
  const res = await axios.post('https://snapinsta.top/action.php', form, {
    headers: {
      ...form.getHeaders(),
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
      accept: '*/*', origin: 'https://snapinsta.top', referer: 'https://snapinsta.top/'
    }
  })
  const $ = cheerio.load(res.data)
  const downloads = []
  $('.download-items__btn a').each((_, el) => {
    let p = $(el).attr('href')
    if (!p) return
    if (!p.startsWith('http')) p = 'https://snapinsta.top' + p
    downloads.push(p)
  })
  return { status: downloads.length ? 200 : 404, download: downloads }
}

async function doIg(m, ctx, text, args) {
  const { conn, usedPrefix, command } = ctx
  const url = (args && args[0]) ? args[0] : text
  if (!url) return m.reply(`*Example:* ${usedPrefix}${command} https://www.instagram.com/p/xxxx/`)
  const res = await igDl(url, m)
  for (const u of res.download) {
    let buf = (await axios.get(u, { responseType: 'arraybuffer' })).data
    buf = Buffer.from(buf)
    if (buf.slice(4, 8).toString() === 'ftyp') {
      await new Button(conn).setMedia({ video: buf }).send(m.chat, { quoted: m })
    } else {
      await new Button(conn).setImage(buf).send(m.chat, { quoted: m })
    }
  }
}

async function doIg3(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  const input = clean(text)
  if (!input) throw `Contoh:\n${usedPrefix}${command} https://instagram.com/...`
  await m.react('✨')
  const resApi = await fetch(`https://api.nexray.eu.cc/downloader/v2/instagram?url=${encodeURIComponent(input)}`)
  if (!resApi.ok) throw 'API error'
  const data = await resApi.json()
  if (!data.status || !data.result || !data.result.media || !data.result.media.length) throw 'Media tidak ditemukan'
  const res = data.result
  const likesCount = res.likes ? res.likes.toLocaleString() : 0
  const caption = `— instagram downloader —\n\n❀ author : ${cleanText(res.username)}\n❀ likes  : ${likesCount}\n\n❀ title :\n${cleanText(res.title || '-')}`.trim()

  const images = [], videos = []
  for (const item of res.media) {
    if (item.type === 'mp4') videos.push(item.url)
    else images.push(item.url)
  }

  if (images.length) {
    const carousel = new Carousel(conn)
      .setBody(caption)
      .setFooter("Swipe untuk melihat media");

    for (const imgUrl of images) {
      const card = await new Button(conn)
        .setImage(imgUrl)
        .setBody("Instagram Post")
        .addUrl("Buka Original", imgUrl)
        .toCard();
      carousel.addCard(card);
    }
    await carousel.send(m.chat, { quoted: m });
  }

  for (const url of videos) {
    await new Button(conn)
      .setMedia({ video: { url } })
      .setBody(caption)
      .send(m.chat, { quoted: m })
  }
  await m.react('✅')
}

async function doIgaudio(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) throw `Contoh:\n${usedPrefix + command} https://www.instagram.com/reel/xxxxx/`
  await m.react('🕒')
  const { data } = await axios.post('https://reelsvideo.io/reel/',
    new URLSearchParams({
      id: text, locale: 'id', 'cf-turnstile-response': '',
      tt: 'a66b23d8bfa4878536d788ac3d33d1a6',
      ts: Math.floor(Date.now() / 1000)
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'HX-Request': 'true', 'HX-Trigger': 'main-form', 'HX-Target': 'target',
        'HX-Current-URL': 'https://reelsvideo.io/id',
        'User-Agent': 'Mozilla/5.0', Referer: 'https://reelsvideo.io/id'
      }
    })
  const $ = cheerio.load(data)
  const mp3 = $('a.type_audio').attr('href')
  if (!mp3) throw 'Audio tidak tersedia di reel ini.'
  await conn.sendMessage(m.chat, {
    audio: { url: mp3 }, mimetype: 'audio/mpeg'
  }, { quoted: m })
}

async function doWallpaper(m, ctx, text) {
  const { conn } = ctx
  let query = text
  if (!query) throw 'Input *URL*'
  m.reply(global.wait || '⏳')
  let wallpapers
  try {
    const mod = await import('../../lib/scrape.js')
    wallpapers = await mod.wallpaper(query)
  } catch (e) { throw new Error('Wallpaper scraper tidak tersedia') }
  const random = wallpapers[Math.floor(Math.random() * wallpapers.length)]
  
  await new Button(conn)
    .setImage(random)
    .setBody('Source: wallpaperflare.com')
    .send(m.chat, { quoted: m })
}

async function doDlit(m, ctx, text, args) {
  const { conn, usedPrefix, command } = ctx
  if (args.length < 2) return m.reply(`Contoh:\n${usedPrefix + command} tiktok https://vt.tiktok.com/ZSBKKk4HS/`)
  const platform = args[0].toLowerCase()
  const inputUrl = args[1]
  if (!['instagram', 'tiktok', 'facebook'].includes(platform))
    return m.reply('Platform tidak valid! Gunakan: instagram, tiktok, atau facebook')
  const SITE_URL = 'https://instatiktok.com/'
  const form = new URLSearchParams()
  form.append('url', inputUrl)
  form.append('platform', platform)
  form.append('siteurl', SITE_URL)
  const res = await axios.post(`${SITE_URL}api`, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: SITE_URL, Referer: SITE_URL,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
  const html = (res && res.data && res.data.html) ? res.data.html : null
  const status = (res && res.data && res.data.status) ? res.data.status : null
  if (!html || status !== 'success') throw 'Gagal ambil data'
  const $ = cheerio.load(html)
  const links = []
  $('a.btn[href^="http"]').each((_, el) => {
    const l = $(el).attr('href')
    if (l && !links.includes(l)) links.push(l)
  })
  if (!links.length) throw 'Link download tidak ditemukan'
  let download
  if (platform === 'instagram') download = links
  else if (platform === 'tiktok') download = links.find(l => /hdplay/.test(l)) || links[0]
  else download = links[links.length - 1]
  
  if (Array.isArray(download)) {
    for (const l of download) await conn.sendFile(m.chat, l, 'media.mp4', `✅ Hasil dari ${platform}`, m)
  } else {
    await conn.sendFile(m.chat, download, 'media.mp4', `✅ Berhasil dari ${platform}`, m)
  }
}

async function doMediafire(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) throw `Contoh:\n${usedPrefix}${command} https://www.mediafire.com/file/xxxxx`
  await m.react('🕒')
  const res = await scraper.mediafiredl(text)
  const caption = `*\`MediaFire Downloader\`*\n\n*Name :* ${res.filename || res.name}\n*Size :* ${res.size}\n*Mime :* ${res.mime || res.ext || '-'}`
  
  await new Button(conn)
    .setBody(caption)
    .addUrl("Download File", res.link || res.url)
    .send(m.chat, { quoted: m })

  await conn.sendFile(m.chat, res.link || res.url, res.filename || res.name, caption, m)
  await m.react('✅')
}

async function pinDl(url) {
  const a = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/17.0 Chrome/96.0.4664.104 Mobile Safari/537.36',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  })
  const $ = cheerio.load(a.data)
  const x = $('script[data-test-id="leaf-snippet"]').text()
  const y = $('script[data-test-id="video-snippet"]').text()
  return {
    status: true,
    isVideo: !!y,
    info: JSON.parse(x),
    image: JSON.parse(x).image,
    video: y ? JSON.parse(y).contentUrl : ''
  }
}

async function doPindl(m, ctx, text) {
  const { conn } = ctx
  if (!text) return conn.sendMessage(m.chat, { text: 'Kirimkan link Pinterest' }, { quoted: m })
  const result = await pinDl(text.trim())
  if (result.status) {
    if (result.isVideo) {
      await new Button(conn).setMedia({ video: { url: result.video } }).send(m.chat, { quoted: m })
    } else {
      await new Button(conn).setImage(result.image).send(m.chat, { quoted: m })
    }
  } else {
    await conn.sendMessage(m.chat, { text: result.mess }, { quoted: m })
  }
}

async function getSnappinToken() {
  const { headers, data } = await axios.get('https://snappin.app/')
  const cookies = headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
  const $ = cheerio.load(data)
  const csrfToken = $('meta[name="csrf-token"]').attr('content')
  return { csrfToken, cookies }
}

async function doPindl2(m, ctx, text, args) {
  const { conn } = ctx
  const url = (args && args[0]) ? args[0] : text
  if (!url) return m.reply('Mana link Pinnya?')
  const { csrfToken, cookies } = await getSnappinToken()
  const { data } = await axios.post('https://snappin.app/', { url }, {
    headers: {
      'Content-Type': 'application/json', 'x-csrf-token': csrfToken,
      Cookie: cookies, Referer: 'https://snappin.app', Origin: 'https://snappin.app',
      'User-Agent': 'Mozilla/5.0'
    }
  })
  const $ = cheerio.load(data)
  const links = $('a.button.is-success').map((_, el) =>$(el).attr('href')).get()
  let mediaUrl = null
  for (const l of links) {
    const full = l.startsWith('http') ? l : 'https://snappin.app' + l
    const head = await axios.head(full).catch(() => null)
    const ct = (head && head.headers && head.headers['content-type']) ? head.headers['content-type'] : ''
    if (ct.includes('video')) { mediaUrl = { url: full, type: 'video' }; break }
    else if (ct.includes('image')) mediaUrl = { url: full, type: 'image' }
  }
  if (!mediaUrl) throw 'Media tidak ditemukan'
  if (mediaUrl.type === 'video') {
    await new Button(conn).setMedia({ video: { url: mediaUrl.url } }).send(m.chat, { quoted: m })
  } else {
    await new Button(conn).setImage(mediaUrl.url).send(m.chat, { quoted: m })
  }
}

async function doPlay(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Mau cari lagu apa?\nContoh: *${usedPrefix + command} Sparkle Radwimps*`)
  await m.react('🔍')
  const search = await yts(text)
  if (!search.videos.length) { await m.react('❌'); return m.reply('Tidak ditemukan.') }
  const video = search.videos[0]

  const infoText = `🎬 *${video.title}*\n\n👤 *Channel:* ${video.author.name}${video.author.verified ? ' ✓' : ''}\n⏱️ *Durasi:* ${video.timestamp || '-'}\n👁️ *Views:* ${formatNumber(video.views)}\n📅 *Upload:* ${video.ago || '-'}`

  const builder = new Button(conn)
    .setImage(video.thumbnail)
    .setBody(infoText)
    .setFooter('VIVY BOT MD')
    .addSelection("Download Options");

  builder.makeSection("🎵 Audio Downloader", "");
  builder.makeRow("", "Audio MP3", "Download audio format MP3 standar", `.ytmp3 ${video.url}`);
  builder.makeRow("", "Audio MP3 V2", "Download audio server alternatif", `.ytmp3v2 ${video.url}`);
  builder.makeRow("", "Audio MP3 File", "Download sebagai dokumen audio", `.ytmp3doc ${video.url}`);
  
  builder.makeSection("🎬 Video Downloader", "Pilih Resolusi");
  builder.makeRow("", "Video MP4 (144p)", "Resolusi hemat data", `.ytmp4 ${video.url}|144`);
  builder.makeRow("", "Video MP4 (240p)", "Resolusi rendah", `.ytmp4 ${video.url}|240`);
  builder.makeRow("", "Video MP4 (360p)", "Resolusi standar", `.ytmp4 ${video.url}|360`);
  builder.makeRow("", "Video MP4 (480p)", "Resolusi medium", `.ytmp4 ${video.url}|480`);
  builder.makeRow("", "Video MP4 (720p)", "Resolusi HD (60fps jika ada)", `.ytmp4 ${video.url}|720`);
  builder.makeRow("", "Video MP4 (1080p)", "Resolusi Full HD", `.ytmp4 ${video.url}|1080`);

  await builder.send(m.chat, { quoted: m })
  await m.react('✅')
}

async function doPlay2(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return conn.reply(m.chat, `Example : ${usedPrefix + command} Swim chase atlantic`, m)
  await m.react('✨')
  const json = await (await fetch(`${global.APIs.faa}/faa/ytplay?query=${encodeURIComponent(text)}`)).json()
  if (!json.status) throw 'API error'
  const d = json.result
  
  await new AIRich(conn)
    .addText(`Title : ${d.title}\nViews : ${d.views}`)
    .addImage(d.thumbnail)
    .send(m.chat, { quoted: m })
    
  await conn.sendMessage(m.chat, {
    audio: { url: d.mp3 }, mimetype: 'audio/mpeg', fileName: `${d.title}.mp3`
  }, { quoted: m })
  await m.react('✅')
}

async function doSfile(m, ctx, text) {
  const { conn, command } = ctx
  if (!text) throw 'Masukkan query atau link!'
  const { sfileSearch, sfileDownload } = await import('../../lib/scrape/sfile.js')
  if (command === 'sfile') {
    const results = await sfileSearch(text)
    if (!results.length) throw 'File tidak ditemukan'
    let msg = '🔎 Hasil pencarian:\n\n'
    results.slice(0, 10).forEach((v, i) => {
      msg += `${i + 1}. ${v.title}\n📦 ${v.size}\n🔗 ${v.link}\n\n`
    })
    m.reply(msg)
  } else if (command === 'sfiledl') {
    if (!text.includes('sfile.co')) throw 'Link tidak valid'
    const { metadata, download } = await sfileDownload(text, true)
    const caption = `📄 Nama: ${metadata.filename}\n📦 Tipe: ${metadata.mimetype}\n⬇️ Download: ${metadata.download_count}\n👤 Author: ${metadata.author_name}`
    
    await new Button(conn)
      .setBody(caption)
      .addUrl("Download SFile", download)
      .send(m.chat, { quoted: m })

    await conn.sendFile(m.chat, download, metadata.filename, caption, m)
  }
}

async function doScdl(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} https://soundcloud.com/chaseatlantic/swim-2`)
  await m.react('🕒')
  const res = await scraper.allinonedownloader(text, 'soundcloud-downloader')
  if (!res || !res.items || !res.items.length) throw 'Audio tidak ditemukan.'
  const media = res.items[0]
  const out = path.join(os.tmpdir(), `${Date.now()}.m4a`)
  await execPromise(`ffmpeg -i "${media.url}" -vn -c:a copy -y "${out}"`)
  
  await new Button(conn)
    .setBody(`*Title:* ${media.title}\n*Quality:* ${media.quality}`)
    .send(m.chat, { quoted: m })
    
  await conn.sendFile(m.chat, out, `${media.title}.m4a`, '', m)
  fs.unlinkSync(out)
  await m.react('✅')
}

async function doSpotify(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} Swim Chase Atlantic\n${usedPrefix + command} https://open.spotify.com/track/...`)
  await m.react('🕒')
  let url = text
  if (!/^https?:\/\/open\.spotify\.com\/track\//i.test(text)) {
    const s = await (await fetch(`${global.APIs.nexray}/search/spotify?q=${encodeURIComponent(text)}`)).json()
    if (!s || !s.status || !s.result || !s.result.length) { await m.react('❌'); return m.reply('❌ Lagu tidak ditemukan.') }
    url = s.result[0].url
  }
  const data = await (await fetch(`${global.APIs.nexray}/downloader/spotify?url=${encodeURIComponent(url)}`)).json()
  if (!data || !data.status) { await m.react('❌'); return m.reply('❌ Gagal mengunduh lagu.') }
  const s = await (await fetch(`${global.APIs.nexray}/search/spotify?q=${encodeURIComponent(data.result.title + ' ' + data.result.artist)}`)).json()
  const info = (s.result && s.result[0]) ? s.result[0] : {}
  const pop = info.popularity !== undefined ? info.popularity : '-'
  const caption = `   *Spotify Downloader*\n\n✿ Title : ${data.result.title}\n✿ Artist : ${data.result.artist}\n✿ Album : ${info.album || '-'}\n✿ Duration : ${info.duration || '-'}\n✿ Release : ${info.release_date || '-'}\n✿ Popularity : ${pop}`
  
  if (info.thumbnail) {
    await new Button(conn).setImage(info.thumbnail).setBody(caption).send(m.chat, { quoted: m })
  } else {
    await m.reply(caption)
  }
  
  await conn.sendMessage(m.chat, {
    audio: { url: data.result.url }, mimetype: 'audio/mpeg', fileName: `${data.result.title}.mp3`
  }, { quoted: m })
  await m.react('✅')
}

async function searchTikTokNexray(query) {
  const { data } = await axios.get('https://api.nexray.eu.cc/search/tiktok', {
    params: { q: query }, headers: { 'user-agent': 'Mozilla/5.0' }
  })
  if (!data || !data.status || !Array.isArray(data.result) || !data.result.length) return null
  const item = data.result.find(v => (v && v.id) || (v && v.data))
  if (!item) return null
  const authorNick = (item.author && item.author.nickname) ? item.author.nickname : 'user'
  const authorFull = (item.author && item.author.fullname) ? item.author.fullname : '-'
  const audioUrl = (item.music_info && item.music_info.url) ? item.music_info.url : null
  
  return {
    url: `https://www.tiktok.com/@${authorNick}/video/${item.id}`,
    directData: item.data ? {
      type: 'video', title: item.title || '-',
      author: authorNick !== 'user' ? authorNick : authorFull,
      video: item.data, images: [], audio: audioUrl
    } : null
  }
}

async function doTiktok(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  await m.react('✨')
  const input = (m.quoted && m.quoted.text) ? m.quoted.text : text
  if (!input) return m.reply(`Contoh:\n${usedPrefix + command} https://vt.tiktok.com/xxxx\n${usedPrefix + command} ryo yamada edit`)

  const { tiktokScrape } = await import('../../lib/scrape/tikwm.js')
  let res = null
  const isUrl = /^https?:\/\//i.test(input.trim())
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

  if (res.type === 'image' && res.images && res.images.length) {
    const carousel = new Carousel(conn)
      .setBody(caption)
      .setFooter("Swipe untuk melihat foto");
      
    for (const img of res.images.slice(0, 10)) {
      const card = await new Button(conn)
        .setImage(img)
        .setBody("TikTok Slide")
        .addUrl("Buka Original", img)
        .toCard();
      carousel.addCard(card);
    }
    
    await carousel.send(m.chat, { quoted: m });
    
    if (res.audio) {
      await conn.sendMessage(m.chat, { audio: { url: res.audio }, mimetype: 'audio/mpeg' }, { quoted: m })
    }
    await m.react('✅')
    return
  }

  if (res.video) {
    await new Button(conn).setMedia({ video: { url: res.video } }).setBody(caption).send(m.chat, { quoted: m })
  }
  if (res.audio) {
    await conn.sendMessage(m.chat, { audio: { url: res.audio }, mimetype: 'audio/mpeg' }, { quoted: m })
  }
  await m.react('✅')
}

async function doTiktok2(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  const input = (m.quoted && m.quoted.text) ? m.quoted.text : text
  if (!input) return m.reply(`Contoh:\n${usedPrefix + command} https://vt.tiktok.com/xxxx\n${usedPrefix + command} ryo yamada edit`)
  await m.react('🕒')
  const { tiktokScrape } = await import('../../lib/scrape/tikwm.js')
  let res = null
  const isUrl = /^https?:\/\//i.test(input.trim())
  if (!isUrl) {
    const s = await searchTikTokNexray(input.trim())
    if (!s) throw 'Hasil pencarian tidak ditemukan'
    res = s.directData || await tiktokScrape(s.url)
  } else {
    res = await tiktokScrape(input.trim())
  }
  if (!res) throw 'Gagal mengambil data TikTok'
  const title = (res.title || '-').replace(/\s+/g, ' ').trim()
  const uploader = res.author || '-'
  const finalTitle = title.length > 80 ? title.slice(0, 80) + '...' : title
  const caption = `TikTok Downloader\n\nJudul: ${finalTitle}\nUploader: ${uploader}`

  if (res.type === 'image' && res.images && res.images.length) {
    const rich = new AIRich(conn).setTitle('TikTok Photo Slide').addText(caption)
    for (const [i, u] of res.images.entries()) if (u) rich.addImage(u, { id: 'image_' + i })
    await rich.send(m.chat, { quoted: m })
    await m.react('✅')
    return
  }

  if (res.video) {
    const rich = new AIRich(conn).setTitle('TikTok Downloader').addText(caption).addVideo({ url: res.video })
    await rich.send(m.chat, { quoted: m })
    await m.react('✅')
    return
  }
  throw 'Media TikTok tidak ditemukan'
}

async function doTtimg(m, ctx, text) {
  const { conn } = ctx
  if (!text) return m.reply('Contoh:\n.ttimg https://vt.tiktok.com/xxxx')
  await m.react('🕒')
  const { tiktokScrape } = await import('../../lib/scrape/tikwm.js')
  const result = await tiktokScrape(text.trim())
  if (!result) return m.reply('Gagal mengambil data TikTok.')
  const images = (result && Array.isArray(result.images)) ? result.images : []
  if (!images.length) return m.reply('Post ini bukan slideshow foto.')
  const title = (result.title || 'TikTok Slide').replace(/\s+/g, ' ').trim()
  const uploader = result.author || '-'
  const infoText = `Judul: ${title}\nUploader: ${uploader}\nTotal Foto: ${images.length}`

  const rich = new AIRich(conn).setTitle('TikTok Photo Slide').addText(infoText)
  for (const [i, u] of images.entries()) if (u) rich.addImage(u, { id: 'image_' + i })
  await rich.send(m.chat, { quoted: m })
  await m.react('✅')
}

async function ttSearchMusic(query) {
  const { data } = await axios.get('https://tikwm.com/api/feed/search', {
    params: { keywords: query, count: 1 }, timeout: 20000
  })
  if (!data || data.code !== 0 || !data.data || !data.data.videos || !data.data.videos.length) throw 'Hasil tidak ditemukan'
  const v = data.data.videos[0]
  return `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`
}

async function ttGetMusic(url) {
  const { data } = await axios.get('https://tikwm.com/api/', { params: { url, hd: 1 }, timeout: 20000 })
  if (!data || data.code !== 0) throw 'Gagal mengambil data TikTok'
  return data.data
}

function formatDuration(sec = 0) {
  const mm = Math.floor(sec / 60).toString().padStart(2, '0')
  const ss = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

async function doTtmusic(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  await m.react('🎵')
  const input = (m.quoted && m.quoted.text) ? m.quoted.text : text
  if (!input) return m.reply(`Contoh:\n${usedPrefix + command} https://vt.tiktok.com/xxxx\n${usedPrefix + command} kurumi edit`)
  let url = input
  if (!/^https?:\/\//i.test(input)) url = await ttSearchMusic(input)
  const res = await ttGetMusic(url)
  if (!res.music) throw 'Audio TikTok tidak ditemukan'
  const title = (res.title || '-').replace(/\s+/g, ' ').trim()
  const authorNick = (res.author && res.author.nickname) ? res.author.nickname : null
  const authorUid = (res.author && res.author.unique_id) ? res.author.unique_id : '-'
  const uploader = authorNick ? authorNick : authorUid
  const duration = formatDuration(res.duration)
  const caption = `— TIKTOK MUSIC —\n\n❀ Judul : ${title.length > 80 ? title.slice(0, 80) + '...' : title}\n❀ Uploader : ${uploader}\n❀ Durasi : ${duration}`
  await conn.sendMessage(m.chat, {
    audio: { url: res.music }, mimetype: 'audio/mpeg', fileName: `${title}.mp3`
  }, { quoted: m })
  await m.reply(caption)
  await m.react('✅')
}

async function doTwitter(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`*Contoh: ${usedPrefix + command} https://x.com/...*`)
  await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
  const body = new URLSearchParams({ q: text, lang: 'id', cftoken: '' })
  const res = await fetch('https://savetwitter.net/api/ajaxSearch', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest', Origin: 'https://savetwitter.net',
      Referer: 'https://savetwitter.net/id3'
    },
    body
  })
  const json = await res.json()
  const html = (json && json.data) ? json.data : null
  if (!html) return m.reply('*Gagal mengambil data video 🍂*')
  
  const mTitle = html.match(/<h3>(.*?)<\/h3>/)
  const title = (mTitle && mTitle[1]) ? mTitle[1].trim() : 'Twitter Video'
  
  const mDur = html.match(/<p>(\d+:\d+)<\/p>/)
  const duration = (mDur && mDur[1]) ? mDur[1] : '-'
  
  const mThumb = html.match(/<img src="([^"]+)"/)
  const thumbnail = (mThumb && mThumb[1]) ? mThumb[1] : ''
  
  const mp4 = [...html.matchAll(/href="(https:\/\/dl\.snapcdn\.app\/get\?token=[^"]+)".*?MP4\s*\(([^)]+)\)/g)]
    .map(v => ({ quality: v[2], url: v[1] }))
  if (!mp4.length) return m.reply('*Video tidak ditemukan 🍂*')
  const best = mp4[0]
  const caption = `*🐦 Twitter Downloader*\n\n📌 Judul: ${title}\n⏱️ Durasi: ${duration}\n🎞️ Kualitas: ${best.quality}`

  await new Button(conn)
    .setMedia({ video: { url: best.url } })
    .setBody(caption)
    .send(m.chat, { quoted: m })
    
  await conn.sendMessage(m.chat, { react: { text: '', key: m.key } })
}

async function doVidey(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`url videy nya mana?\ncontoh : ${usedPrefix + command} https://videy.co/v?id=4F2uO7k21`)
  const parsed = new URL(text)
  const id = parsed.searchParams.get('id')
  if (!id) throw 'url invalid, harus ada parameter id'
  
  await new Button(conn)
    .setMedia({ video: { url: `https://cdn.videy.co/${id}.mp4` } })
    .setBody('*Videy downloader*')
    .send(m.chat, { quoted: m })
}

async function doYtmp3(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} https://youtu.be/dQw4w9WgXcQ`)
  if (!/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(text))
    return m.reply('Masukkan link YouTube yang valid!')
  await m.react('⏳')
  const ytConstructor = scraper.savetube || (scraper.default && scraper.default.savetube)
  const yt = new ytConstructor()
  const res = await yt.download(text, 'mp3')
  if (!res || !res.dl) throw new Error('URL download tidak ditemukan.')
  const size = await fetchHeadSize(res.dl)
  const isDocCommand = /^(ytmp3doc|ytmp3file)$/i.test(command)
  const isDoc = isDocCommand || size > SIZELIMIT
  if (isDoc) {
    await conn.sendMessage(m.chat, {
      document: { url: res.dl }, mimetype: 'audio/mpeg', fileName: `${res.title || 'audio'}.mp3`
    }, { quoted: m })
  } else {
    await conn.sendMessage(m.chat, {
      audio: { url: res.dl }, mimetype: 'audio/mpeg', fileName: `${res.title || 'audio'}.mp3`, ptt: false
    }, { quoted: m })
  }
  await m.react('✅')
}

async function doYtmp3v2(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return conn.reply(m.chat, `Example : ${usedPrefix + command} https://youtu.be/ZAfAud_M_mg`, m)
  await m.react('✨')
  const json = await (await fetch(`${global.APIs.faa}/faa/ytmp3?url=${encodeURIComponent(text)}`)).json()
  if (!json.status) throw 'API error'
  const { title, thumbnail, duration, mp3 } = json.result
  
  await new Button(conn).setImage(thumbnail).setBody(`Title : ${title}\nDuration : ${duration}`).send(m.chat, { quoted: m })
  
  const size = await fetchHeadSize(mp3)
  if (size > SIZELIMIT) {
    await conn.sendMessage(m.chat, { document: { url: mp3 }, mimetype: 'audio/mpeg', fileName: `${title}.mp3` }, { quoted: m })
  } else {
    await conn.sendMessage(m.chat, { audio: { url: mp3 }, mimetype: 'audio/mpeg', fileName: `${title}.mp3` }, { quoted: m })
  }
  await m.react('✅')
}

async function doYtmp3v3(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} https://youtu.be/dQw4w9WgXcQ`)
  await m.react('🕒')
  const yt = new scraper.savetube()
  const res = await yt.download(text, 'mp3')
  if (!res.status) throw res.msg || res.error || 'Gagal mengunduh audio.'
  const caption = `*Title:* ${res.title}\n*Format:* MP3\n*Duration:* ${res.duration} detik`
  
  await new Button(conn).setImage(res.thumb).setBody(caption).send(m.chat, { quoted: m })
  
  await conn.sendMessage(m.chat, {
    audio: { url: res.dl }, mimetype: 'audio/mpeg', fileName: `${res.title}.mp3`
  }, { quoted: m })
  await m.react('✅')
}

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
    const task = (res.data && res.data.task) ? res.data.task : null
    if (task && task.status === 'finished' && task.downloadUrl) return task.downloadUrl
    const res2 = await axios.get(convUrl, { headers: { ...YTMP4_CONFIG.HEADERS, Referer: 'https://ytb.rip/' }, maxRedirects: 0, validateStatus: s => s < 400 })
    const loc = (res2.headers && res2.headers.location) ? res2.headers.location : ''
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
      if (!data || !data.url) return { success: false, message: 'Gagal mendapatkan data video' }
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
        data: {
          title: dMeta.title, ext: 'mp4',
          filesize: sel.contentLength || sel.filesize || null,
          download_url: dlUrl, is60fps: !!m60
        }
      }
    } catch (e) { return { success: false, message: e.message } }
  }
}

async function doYtmp4(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} https://youtube.com/watch?v=xxxx|720`)
  let parts = text.split('|')
  let query = parts[0].trim()
  let qualityInput = parts.length > 1 ? parts[1].trim() : '360'
  let url = query, durationSeconds = 0
  try {
    const search = await yts(query)
    const video = (search.videos && search.videos[0]) ? search.videos[0] : null
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
  
  await new Button(conn)
    .setMedia({ video: { url: download_url } })
    .setBody(caption)
    .send(m.chat, { quoted: m })
  await m.react('✅')
}

async function doYtmp4v2(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return conn.reply(m.chat, `Example : ${usedPrefix + command} https://youtu.be/cii6ruuycQA`, m)
  await m.react('✨')
  const json = await (await fetch(`${global.APIs.faa}/faa/ytmp4?url=${encodeURIComponent(text)}`)).json()
  if (!json.status) throw 'API error'
  const video = json.result.download_url
  const size = await fetchHeadSize(video)
  if (size > SIZELIMIT) {
    await conn.sendMessage(m.chat, { document: { url: video }, mimetype: 'video/mp4', fileName: 'video.mp4' }, { quoted: m })
  } else {
    await new Button(conn).setMedia({ video: { url: video } }).send(m.chat, { quoted: m })
  }
  await m.react('✅')
}

async function doYtmp4v3(m, ctx, text) {
  const { conn, usedPrefix, command } = ctx
  if (!text) return m.reply(`Contoh:\n${usedPrefix + command} https://youtu.be/dQw4w9WgXcQ`)
  await m.react('🕒')
  const yt = new scraper.savetube()
  const res = await yt.download(text, '720')
  if (!res.status) throw res.msg || res.error || 'Gagal mengunduh video.'
  const caption = `*Title:* ${res.title}\n*Format:* ${res.format}\n*Duration:* ${res.duration} detik`
  
  await new Button(conn)
    .setMedia({ video: { url: res.dl } })
    .setBody(caption)
    .send(m.chat, { quoted: m })
  await m.react('✅')
}

const DISPATCH = {
  aio: doAio,
  aio2: doAio2,
  applemusic: doAppleMusic, aplmusic: doAppleMusic, applemp3: doAppleMusic,
  bilibili: doBilibili, bili: doBilibili, blibli: doBilibili,
  capcut: doCapcut,
  douyin: doDouyin,
  facebook: doFacebook, fb: doFacebook,
  gitclone: doGitclone,
  gdrive: doGdrive,
  ig: doIg, igdl: doIg, instagram: doIg,
  ig3: doIg3, igdl3: doIg3, instagram3: doIg3,
  igaudio: doIgaudio, igmp3: doIgaudio,
  wallpaper: doWallpaper,
  dlit: doDlit,
  mediafire: doMediafire, mf: doMediafire,
  pindl: doPindl,
  pindl2: doPindl2,
  play: doPlay,
  play2: doPlay2,
  sfile: doSfile, sfiledl: doSfile,
  scdl: doScdl, soundcloud: doScdl,
  spotify: doSpotify, spotifydl: doSpotify, spotifymp3: doSpotify,
  tt: doTiktok, tiktok: doTiktok,
  tt2: doTiktok2, tiktok2: doTiktok2,
  ttimg: doTtimg, tiktokimg: doTtimg,
  ttmusic: doTtmusic, tiktokmusic: doTtmusic, ttmp3: doTtmusic,
  twitter: doTwitter, tw: doTwitter, xdl: doTwitter,
  videy: doVidey,
  ytmp3: doYtmp3, ytmp3doc: doYtmp3, ytmp3file: doYtmp3,
  ytmp3v2: doYtmp3v2,
  ytmp3v3: doYtmp3v3,
  ytmp4: doYtmp4, playvid: doYtmp4,
  ytmp4v2: doYtmp4v2,
  ytmp4v3: doYtmp4v3
}

export default {
  name: "All in One Downloader",
  command: ["aio", "alldl"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Auto deteksi link untuk download media (Tiktok, IG, YT, dll)",
  category: "downloader",
  async run(conn, m, { jid, args, usedPrefix, command, quotedText }) {
    const text = args.join(" ") || quotedText || "";
    
    if (!text) {
      return await m.reply(`Mana linknya?\n\nContoh penggunaan:\n> ${usedPrefix + command} https://vt.tiktok.com/xxxx/`);
    }

    let fn = null;
    if (/tiktok\.com|douyin\.com/i.test(text)) fn = doTiktok;
    else if (/instagram\.com/i.test(text)) fn = doIg3;
    else if (/(youtube\.com|youtu\.be)/i.test(text)) fn = doYtmp4; 
    else if (/spotify\.com/i.test(text)) fn = doSpotify;
    else if (/(facebook\.com|fb\.watch)/i.test(text)) fn = doFacebook;
    else if (/(pin\.it|pinterest\.com)/i.test(text)) fn = doPindl;
    else if (/capcut\.com/i.test(text)) fn = doCapcut;
    else if (/mediafire\.com/i.test(text)) fn = doMediafire;
    else if (/bilibili\.tv/i.test(text)) fn = doBilibili;
    else if (/(x\.com|twitter\.com)/i.test(text)) fn = doTwitter;
    else if (/music\.apple\.com/i.test(text)) fn = doAppleMusic;
    else if (/soundcloud\.com/i.test(text)) fn = doScdl;
    else if (/videy\.co/i.test(text)) fn = doVidey;
    else fn = doAio; 

    try {
      const ctx = { conn, text, args, usedPrefix, command };
      await fn(m, ctx, text, args);
    } catch (e) {
      console.error(`[AIO DOWNLOADER ERROR]`, e);
      try { await m.react('❌'); } catch {}
      const errMsg = (typeof e === 'string') ? e : (e && e.message ? e.message : 'Terjadi kesalahan saat memproses tautan.');
      await m.reply(errMsg);
    }
  }
}
