'use strict'

const { spawnSync, spawn } = require('child_process')
const isWin = process.platform === 'win32'
const { URL } = require('url')
const fs = require('fs')
const path = require('path')
const AppError = require('../utils/appError.utils')
const os = require('os')


const cookieFile = path.join(__dirname, '..', 'configs', 'all_cookies.txt')

const ALLOWED_HOSTS = new Set([ 'youtube.com', 'www.youtube.com', 'youtu.be' ])


const ytDlpPath = isWin
  ? spawnSync('where', ['yt-dlp']).stdout.toString().split('\n')[0].trim()
  : spawnSync('which', ['yt-dlp']).stdout.toString().trim()


if (!ytDlpPath) {
  throw new Error('yt-dlp not found in PATH')
}

function validateYoutubeUrl(input) {
  let u
  try {
    u = new URL(input)
  } catch {
    return false
  }

  if (u.protocol !== 'https:') return false
  if (!ALLOWED_HOSTS.has(u.hostname)) return false

  return true
}

function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath) } catch {}
  }
}

function getAudioConfig(format) {
  switch ((format || 'mp3').toLowerCase()) {
    case 'mp3': return { ext: 'mp3', mime: 'audio/mpeg' }
    case 'aac': return { ext: 'aac', mime: 'audio/aac' }
    case 'm4a': return { ext: 'm4a', mime: 'audio/mp4' }
    case 'opus': return { ext: 'opus', mime: 'audio/opus' }
    case 'wav': return { ext: 'wav', mime: 'audio/wav' }
    default: return { ext: 'mp3', mime: 'audio/mpeg' }
  }
}




exports.renderHomePage = (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', 'public', 'yt.home.html')
    return res.status(200).sendFile(filePath)
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load page' })
  }
}



exports.getApiVideoInfo = async (req, res, next) => {
  let ytdlp
  let output = ''

  try {
    const videoUrl = req.query.url
    if (!videoUrl || !validateYoutubeUrl(videoUrl)) {
      throw new AppError('Invalid YouTube URL', 400)
    }

    console.log(ytDlpPath)
    ytdlp = spawn(ytDlpPath, ['--no-warnings', '-j', '--no-playlist', '--cookies', cookieFile, videoUrl])

    ytdlp.stdout.on('data', d => {
      output += d.toString()
    })

    let errorOutput = ''
    ytdlp.stderr.on('data', (d) => {
      errorOutput += d.toString()
    })
    

    ytdlp.on('close', code => {
      if (code !== 0) {
        console.error('yt-dlp failed:', errorOutput)
        return next(new AppError('Failed to fetch video info', 500, 'INTERNAL_ERROR'))
      }

      let meta;
      try {
        meta = JSON.parse(output)
      } catch (err) {
        console.error('Failed to parse yt-dlp output:', output)
        return next(new AppError('Failed to parse video info', 500, 'INTERNAL_ERROR'))
      }

      const formats = meta.formats
        .filter(f =>
          f.ext === 'mp4' &&
          f.vcodec !== 'none' &&
          f.acodec !== 'none'
        )
        .map(f => ({
          formatId: f.format_id,
          resolution: f.height ? `${f.height}p` : null,
          fps: f.fps,
          filesize: f.filesize || f.filesize_approx || null,
          vcodec: f.vcodec,
          acodec: f.acodec
        }))

      console.log('Video info fetched successfully')
      return res.json({ success: true,
        data: {
          title: meta.title,
          duration: meta.duration,
          thumbnail: meta.thumbnail,
          uploader: meta.uploader,
          formats
        }
      })
    })

    req.on('close', () => {
      if (ytdlp) ytdlp.kill('SIGKILL')
    })

  } catch (err) {
    console.log('Error in getVideoInfo:', err)
    if (ytdlp) ytdlp.kill('SIGKILL')
    next(err)
  }
}


exports.getAPiDownloadVideo = async (req, res, next) => {
  let ytdlp
  let filePath

  try {
    const {
      url,
      type = 'video',
      quality = 'best',
      formatId,
      audioFormat = 'mp3',
      includeSubs = 'false',
      subLang = 'en',
      embedSubs = 'false',
      startTime,
      endTime,
      filename
    } = req.query

    if (!url || !validateYoutubeUrl(url)) {
      throw new AppError('Invalid YouTube URL', 400)
    }

    const rawTitle = req.query.title || 'video'
    const videoTitle = rawTitle

    const videoQuality = quality || 'best'
    const now = new Date()
    const timeStamp = now.toISOString().replace(/[:.]/g, '-')

    const sanitizedTitle = videoTitle.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_')

    const safeFileName = filename
      ? filename.replace(/[^a-zA-Z0-9-_]/g, '')
      : `${sanitizedTitle}_${videoQuality}_${timeStamp}`

    let outputExt = 'mp4'
    let contentType = 'video/mp4'
    if (type === 'audio') {
      const audioCfg = getAudioConfig(audioFormat)
      outputExt = audioCfg.ext
      contentType = audioCfg.mime
    }

    filePath = path.join(os.tmpdir(), `${safeFileName}.${outputExt}`)

    const args = [url, '--no-warnings', '--no-playlist', '--cookies', cookieFile,'-o', filePath]

    if (type === 'audio') {
      args.push('-x', '--audio-format', audioFormat || 'mp3', '--audio-quality', '0')
    } else {
      if (!quality || isNaN(quality) && quality !== 'best') {
        throw new AppError('Invalid video quality', 400)
      }

      if (type !== 'audio') {
        args.push(
          '-f',
          formatId
            ? formatId
            : quality === 'best'
              ? 'bestvideo[ext=mp4][vcodec!=av1]+bestaudio[ext=m4a]/best'
              : `bestvideo[height<=${quality}][vcodec!=av1]+bestaudio[ext=m4a]/best`,
          '--merge-output-format', 'mp4'
        )
      }
            
    }

    if (includeSubs === 'true') {
      args.push('--write-subs', '--sub-lang', subLang)
      if (embedSubs === 'true') args.push('--embed-subs')
    }

    if (startTime || endTime) {
      args.push('--download-sections', `*${startTime || '00:00:00'}-${endTime || ''}`)
    }

    ytdlp = spawn(ytDlpPath, args)

    ytdlp.stderr.on('data', data => {
     
    })

    ytdlp.on('error', () => {
      cleanupFile(filePath)
      next(new AppError('yt-dlp execution failed', 500))
    })

    ytdlp.on('close', code => {
      if (code !== 0) {
        cleanupFile(filePath)
        return next(new AppError('Download failed', 500))
      }

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeFileName}.${outputExt}"`
      )
      res.setHeader('Content-Type', contentType)

      const stream = fs.createReadStream(filePath)
      stream.pipe(res)
      stream.on('close', () => cleanupFile(filePath))
      stream.on('error', () => {
        cleanupFile(filePath)
        next(new AppError('File streaming failed', 500))
      })
    })

    req.on('close', () => {
      if (ytdlp) ytdlp.kill('SIGTERM')
      cleanupFile(filePath)
    })
    console.log('Download Successfull.')
    
  } catch (err) {
    console.log('Error in downloadVideo:', err)
    if (ytdlp) ytdlp.kill('SIGTERM')
    cleanupFile(filePath)
    next(err)
  }
}




 
