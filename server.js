// Константы
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');

const fs = require('fs');
const os = require('os');
const path = require('path');
const app = express();

// Инфо - выдает версию ffmpeg
app.get('/info', (req, res) => {
  exec('ffmpeg -version', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).send(`<pre>Error: ${error.message}\n${stderr}</pre>`);
    }
    res.send(`<pre>${stdout}</pre>`);
  });
});

// Создаём временную папку
const audioUpload = '/tmp/audio-uploads';
if (!fs.existsSync(audioUpload)) {
  fs.mkdirSync(audioUpload, { recursive: true });
}

// Настройка multer: сохраняем как .ogg
const storage = multer.diskStorage({
  destination: audioUpload,
  filename: (req, file, cb) => {
    // Генерируем уникальное имя с расширением .ogg
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `voice-${uniqueSuffix}.ogg`);
  }
});
const upload = multer({ storage: storage });

// Эндпоинты
app.post('/ogg2mp3', upload.single('audio'), async (req, res) => {
  try {
    const inputPath = req.file.path; // Теперь это .../voice-12345.ogg
    const outputPath = inputPath.replace('.ogg', '.mp3');

    // Конвертируем
    const command = `ffmpeg -y -i "${inputPath}" -ar 22050 -ac 1 -b:a 64k "${outputPath}"`;
    
    // Выполняем и ждём завершения
    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        console.log('FFmpeg stdout:', stdout);
        console.error('FFmpeg stderr:', stderr);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('MP3 file was not created');
    }

    const mp3Buffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(mp3Buffer);

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).send('Failed to convert audio');
  }
});

// Реализуем поворот фотографии
const imageRotateUpload = multer({ 
  dest: '/tmp/rotate-image/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10 МБ
});
const rotateImageDir = '/tmp/rotate-image';
if (!fs.existsSync(rotateImageDir)) {
  fs.mkdirSync(rotateImageDir, { recursive: true });
}
app.post('/rotate-image', imageRotateUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No image provided');
    }

    const angleImage = req.query.angle; // '90', '-90', '180'
    if (!['90', '-90', '180'].includes(angleImage)) {
      return res.status(400).send('Invalid angle: use 90, -90, or 180');
    }

    const inputPath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const outputPath = `/tmp/rotated-image-${Date.now()}${ext}`;

    let vf;
    if (angleImage === '90') {
      vf = 'transpose=1';
    } else if (angleImage === '-90') {
      vf = 'transpose=2';
    } else if (angleImage === '180') {
      vf = 'hflip,vflip';
    }

    const command = `ffmpeg -i "${inputPath}" -vf "${vf}" -y "${outputPath}"`;

    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg rotate error:', stderr);
          reject(new Error('Rotation failed'));
        } else {
          resolve();
        }
      });
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Output image not created');
    }

    const imgBuffer = fs.readFileSync(outputPath);
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', mimeType);
    res.send(imgBuffer);

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

  } catch (error) {
    console.error('Rotate error:', error);
    res.status(500).send('Image rotation failed');
  }
});

// Релизуем поворот видео
const videoRotateUpload = multer({ 
  dest: '/tmp/rotate-video/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50 МБ
});
const rotateVideoDir = '/tmp/rotate-video';
if (!fs.existsSync(rotateVideoDir)) {
  fs.mkdirSync(rotateVideoDir, { recursive: true });
}
app.post('/rotate-video', videoRotateUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No video provided');
    }

    const angleVideo = req.query.angle; // '90', '-90', '180'
    if (!['90', '-90', '180'].includes(angleVideo)) {
      return res.status(400).send('Invalid angle: use 90, -90, or 180');
    }

    const inputPath = req.file.path;
    const outputPath = `/tmp/rotated-video-${Date.now()}.mp4`;

    let vf;
    if (angleVideo === '90') {
      vf = 'transpose=1';
    } else if (angleVideo === '-90') {
      vf = 'transpose=2';
    } else if (angleVideo === '180') {
      vf = 'hflip,vflip';
    }

    // -c:a copy — не перекодируем аудио
    const command = `ffmpeg -i "${inputPath}" -vf "${vf}" -c:a copy -y "${outputPath}"`;

    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Video rotate error:', stderr);
          reject(new Error('Video rotation failed'));
        } else {
          resolve();
        }
      });
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Rotated video not created');
    }

    const videoBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', videoBuffer.length);
    res.send(videoBuffer);

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

  } catch (error) {
    console.error('Rotate-video error:', error);
    res.status(500).send('Video rotation failed');
  }
});

// Стоп-кадр из видео
const videoToImageUpload = multer({ 
  dest: '/tmp/video2image/',
  limits: { fileSize: 50 * 1024 * 1024 }
});
const videoToImageDir = '/tmp/video2image';
if (!fs.existsSync(videoToImageDir)) {
  fs.mkdirSync(videoToImageDir, { recursive: true });
}
app.post('/video2image', videoToImageUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video provided' });
    }

    const timestamp = req.query.timestamp || '00:00:01.000';
    const format = (req.query.format || 'jpg').toLowerCase();
    if (!['jpg', 'png'].includes(format)) {
      return res.status(400).json({ error: 'Format must be jpg or png' });
    }

    const inputPath = req.file.path;
    const outputPath = `/tmp/thumbnail-${Date.now()}.${format}`;

    // Извлекаем кадр
    const command = `ffmpeg -i "${inputPath}" -ss ${timestamp} -vframes 1 -y "${outputPath}"`;
    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) reject(new Error(`FFmpeg failed: ${stderr}`));
        else resolve();
      });
    });

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ error: 'Frame extraction failed' });
    }

    // Получаем размеры через FFprobe (входит в FFmpeg)
    const probeCommand = `ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${outputPath}"`; // 🟢 Добавили -select_streams v:0 для надежности
    let probeStdout;

    try {
        const result = await new Promise((resolve, reject) => {
            // exec возвращает stdout как строку, если не указано иное
            exec(probeCommand, { encoding: 'utf8' }, (error, stdout, stderr) => {
                if (error) {
                    console.error('FFprobe error:', stderr);
                    reject(new Error(`FFprobe failed to get dimensions: ${stderr.substring(0, 100)}`));
                } else {
                    resolve(stdout); // Возвращаем чистый stdout
                }
            });
        });
        probeStdout = result;
    } catch (e) {
        throw e; // Пробрасываем ошибку FFprobe
    }

    // ИСПРАВЛЕНИЕ: Разбиваем по запятой, а не по новой строке, и берем только первое совпадение
    const dimensionsString = probeStdout.trim().split('\n')[0] || ''; 
    const [widthStr, heightStr] = dimensionsString.split(',');
    
    // Проверяем и конвертируем
    const width = Number(widthStr);
    const height = Number(heightStr);

    if (isNaN(width) || isNaN(height) || width === 0 || height === 0) {
        console.error('Parsed dimensions:', widthStr, heightStr);
        throw new Error('Parsed width or height is invalid (NaN or 0)');
    }

    // Читаем изображение и конвертируем в base64
    const imgBuffer = fs.readFileSync(outputPath);
    const base64 = imgBuffer.toString('base64');
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';

    // Удаляем временные файлы
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    // Возвращаем JSON
    res.json({
      success: true,
      image: `data:${mimeType};base64,${base64}`,
      width,
      height,
      format
    });

  } catch (error) {
    console.error('Video2Image error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Поддержка извлечения аудио из видео
const videoUpload = multer({ 
  dest: '/tmp/video-uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50 МБ максимум
});
// Убедимся, что папка существует
const videoDir = '/tmp/video-uploads';
if (!fs.existsSync(videoDir)) {
  fs.mkdirSync(videoDir, { recursive: true });
}
app.post('/video2mp3', videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No video file provided');
    }

    const inputPath = req.file.path;
    const outputPath = input_path => input_path.replace(/\.[^/.]+$/, "") + '.mp3';

    const command = `ffmpeg -i "${inputPath}" -vn -ab 128k -ar 22050 -y "${outputPath(inputPath)}"`;

    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        console.log('Video2MP3 stdout:', stdout.trim());
        console.error('Video2MP3 stderr:', stderr.trim());
        if (error) {
          reject(new Error(`FFmpeg failed: ${stderr || error.message}`));
        } else {
          resolve();
        }
      });
    });

    const mp3Path = outputPath(inputPath);
    if (!fs.existsSync(mp3Path)) {
      throw new Error('MP3 file was not created');
    }
    if (fs.statSync(mp3Path).size < 128) {
      throw new Error('Audio track is empty or missing');
    }
    const mp3Buffer = fs.readFileSync(mp3Path);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', mp3Buffer.length);
    res.send(mp3Buffer);

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(mp3Path);

  } catch (error) {
    console.error('Video2MP3 error:', error);
    res.status(500).send(`Extraction failed: ${error.message}`);
  }
});

// Middleware для обработки сырых бинарных данных (PCM)
app.use('/pcm2mp3', express.raw({ 
  type: 'application/octet-stream',
  limit: '20mb' // лимит размера PCM
}));
app.post('/pcm2mp3', async (req, res) => {
  try {
    // req.body — это Buffer с сырыми PCM-данными
    if (!req.body || req.body.length === 0) {
      return res.status(400).send('Empty PCM data');
    }

    // Параметры по умолчанию (подстройте под ваш TTS)
    const sampleRate = parseInt(req.query.sampleRate) || 24000;
    const channels = parseInt(req.query.channels) || 1;
    const format = req.query.format || 's16le'; // signed 16-bit little-endian

    // Проверяем допустимые значения
    if (![8000, 16000, 22050, 24000, 44100, 48000].includes(sampleRate)) {
      return res.status(400).send('Invalid sampleRate');
    }
    if (![1, 2].includes(channels)) {
      return res.status(400).send('Invalid channels (must be 1 or 2)');
    }
    if (!['s16le', 's16be', 'f32le'].includes(format)) {
      return res.status(400).send('Unsupported format (use s16le, s16be, f32le)');
    }

    // Сохраняем PCM во временный файл
    const inputPath = `/tmp/pcm-${Date.now()}.raw`;
    const outputPath = inputPath.replace('.raw', '.mp3');

    fs.writeFileSync(inputPath, req.body);

    // Команда FFmpeg
    const command = `ffmpeg -f ${format} -ar ${sampleRate} -ac ${channels} -i "${inputPath}" -b:a 64k "${outputPath}"`;

    // Выполняем
    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        console.log('PCM → MP3 stdout:', stdout.trim());
        console.error('PCM → MP3 stderr:', stderr.trim());
        if (error) {
          reject(new Error(`FFmpeg failed: ${stderr || error.message}`));
        } else {
          resolve();
        }
      });
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('MP3 file not created');
    }

    const mp3Buffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', mp3Buffer.length);
    res.send(mp3Buffer);

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

  } catch (error) {
    console.error('PCM conversion error:', error);
    res.status(500).send(`Conversion failed: ${error.message}`);
  }
});

// Видео в GIF
const { spawn } = require('child_process');

// Гарантированно безопасные пути
const TMP_DIR = os.tmpdir();
const UPLOAD_DIR = path.join(TMP_DIR, 'gif');
const OUTPUT_DIR = path.join(TMP_DIR, 'video2gif');

// Создаём директории, если их нет
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const gifUpload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/video2gif', gifUpload.single('video'), async (req, res) => {
  let inputPath = null;
  let outputPath = null;
  let palettePath = null;

  const cleanup = () => {
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    if (palettePath && fs.existsSync(palettePath)) fs.unlinkSync(palettePath);
  };

  try {
    if (!req.file) {
      return res.status(400).send('No video provided');
    }
    inputPath = req.file.path;

    // --- 🔍 ПРОВЕРКА ВХОДНОГО ФАЙЛА ---
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }

    const stats = fs.statSync(inputPath);
    if (stats.size < 1024) {
      throw new Error(`Input file is too small or empty: ${inputPath} (${stats.size} bytes)`);
    }

    // Параметры
    const start = req.query.start || '0';
    const end = req.query.end;
    const format = (req.query.format || 'gif').toLowerCase();
    const fps = Math.min(Math.max(parseInt(req.query.fps) || 10, 1), 30);
    const width = Math.min(Math.max(parseInt(req.query.width) || 480, 100), 1280);

    if (!end) {
      return res.status(400).send('Missing "end" parameter');
    }

    const startSec = parseFloat(start);
    const endSec = parseFloat(end);
    if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) {
      return res.status(400).send('Invalid start or end time');
    }

    const duration = endSec - startSec;
    if (duration > 5 || duration <= 0) {
      return res.status(400).send('Duration must be between 0.1 and 5 seconds');
    }

    // Гарантированно безопасный путь для выходного файла
    outputPath = path.join(OUTPUT_DIR, `output-${Date.now()}.${format === 'mp4' ? 'mp4' : 'gif'}`);

    if (format === 'mp4') {
      // MP4: видео-стикер для Telegram
      const args = [
        '-ss', start.toString(),
        '-to', end.toString(),
        '-i', inputPath,
        '-an',
        '-vf', `fps=${fps},scale=${width}:-2`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'superfast',
        '-y',
        outputPath
      ];
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args);
        let stderr = '';
        ffmpeg.stderr.on('data', (data) => stderr += data.toString());
        ffmpeg.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg MP4 failed: ${stderr}`));
        });
      });
    } else {
      // GIF: двухпроходная генерация
      palettePath = path.join(OUTPUT_DIR, `palette-${Date.now()}.png`);
      
      // Проход 1: генерация палитры
      const args1 = [
        '-ss', start.toString(),
        '-t', duration.toString(),
        '-i', inputPath,
        '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen`,
        '-y',
        palettePath
      ];
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args1);
        let stderr = '';
        ffmpeg.stderr.on('data', (data) => stderr += data.toString());
        ffmpeg.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg palette failed: ${stderr}`));
        });
      });

      // Проход 2: применение палитры
      const args2 = [
        '-ss', start.toString(),
        '-t', duration.toString(),
        '-i', inputPath,
        '-i', palettePath,
        '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos [x]; [x][1:v] paletteuse`,
        '-y',
        outputPath
      ];
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args2);
        let stderr = '';
        ffmpeg.stderr.on('data', (data) => stderr += data.toString());
        ffmpeg.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg GIF failed: ${stderr}`));
        });
      });
    }

    // --- 🔍 ПРОВЕРКА ВЫХОДНОГО ФАЙЛА ---
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Output file not created: ${outputPath}`);
    }

    const buffer = fs.readFileSync(outputPath);
    const contentType = format === 'mp4' ? 'video/mp4' : 'image/gif';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (error) {
    console.error('GIF/Sticker error:', error);
    res.status(500).send(`Conversion failed: ${error.message}`);
  } finally {
    cleanup();
  }
});

// GIF в видео
const gifToVideoUpload = multer({ 
  dest: '/tmp/gif2video/',
  limits: { fileSize: 25 * 1024 * 1024 } // 25 МБ — макс. размер GIF
});
app.post('/gif2video', gifToVideoUpload.single('gif'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No GIF provided');
    }

    const inputPath = req.file.path;
    const outputPath = `/tmp/converted-${Date.now()}.mp4`;

    // Конвертация GIF → MP4 (без звука, оптимизировано)
    const command = `ffmpeg -i "${inputPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -r 15 -y "${outputPath}"`;

    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('GIF→MP4 error:', stderr);
          reject(new Error(`FFmpeg failed: ${stderr}`));
        } else {
          resolve();
        }
      });
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('MP4 file not created');
    }

    const videoBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', videoBuffer.length);
    res.send(videoBuffer);

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

  } catch (error) {
    console.error('GIF2Video error:', error);
    res.status(500).send(`Conversion failed: ${error.message}`);
  }
});

// Изменение разрешения изображения с сохранением пропорций
const resizeImageUpload = multer({
  dest: '/tmp/resize-image/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10 МБ
});
app.post('/resize-image', resizeImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No image provided');
    }

    const resolution = req.query.resolution || '480p';
    const resolutions = {
      '240p': 240,
      '360p': 360,
      '480p': 480,
      '580p': 580,
      '640p': 640,
      '720p': 720,
      '1080p': 1080,
      '1440p': 1440,
      '2160p': 2160,
      '2k': 1440,
      '4k': 2160
    };
    const height = resolutions[resolution];
    if (height === undefined) {
      return res.status(400).send('Invalid resolution. Use: 240p, 360p, 480p, 580p, 640p, 720p, 1080p, 1440p, 2160p');
    }

    const inputPath = req.file.path;
    
    // Определяем формат выхода по расширению исходного файла
    const ext = path.extname(req.file.originalname).toLowerCase();
    const outputPath = `/tmp/resized-${Date.now()}${ext}`;

    // FFmpeg: масштабируем по высоте, ширина — пропорционально и чётная
    const filter = `scale=-2:${height}`;
    const command = `ffmpeg -i "${inputPath}" -vf "${filter}" -y "${outputPath}"`;

    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Resize-image error:', stderr);
          reject(new Error('FFmpeg resize failed'));
        } else {
          resolve();
        }
      });
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Resized image not created');
    }

    const imgBuffer = fs.readFileSync(outputPath);
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', imgBuffer.length);
    res.send(imgBuffer);

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

  } catch (error) {
    console.error('Resize-image handler error:', error);
    res.status(500).send(`Resize failed: ${error.message}`);
  }
});

// Конвертация видео в заданное разрешение
const resizeUpload = multer({
  dest: '/tmp/resize-video/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50 МБ
});
const resizeVideoDir = '/tmp/resize-video';
if (!fs.existsSync(resizeVideoDir)) {
  fs.mkdirSync(resizeVideoDir, { recursive: true });
}
app.post('/resize-video', resizeUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No video provided');
    }

    const resolution = req.query.resolution || '480p';
    const resolutions = {
      '240p': 240,
      '360p': 360,
      '480p': 480,
      '580p': 580,
      '640p': 640,
      '720p': 720,
      '1080p': 1080,
      '1440p': 1440,
      '2160p': 2160,
      '2k': 1440,
      '4k': 2160
    };
    const height = resolutions[resolution];
    if (height === undefined) {
      return res.status(400).send('Invalid resolution. Use: 240p, 360p, 480p, 580p, 640p, 720p, 1080p, 1440p, 2160p');
    }

    const inputPath = req.file.path;
    const outputPath = `/tmp/resized-${Date.now()}.mp4`;

    // Масштабируем по высоте, ширина — пропорционально и чётная
    const videoFilter = `scale=-2:${height}`;
    const command = `ffmpeg -i "${inputPath}" -vf "${videoFilter}" -c:a copy -y "${outputPath}"`;

    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Resize error:', stderr);
          reject(new Error('FFmpeg resize failed'));
        } else {
          resolve();
        }
      });
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Resized video not created');
    }

    const videoBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', videoBuffer.length);
    res.send(videoBuffer);

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

  } catch (error) {
    console.error('Resize-video error:', error);
    res.status(500).send(`Resize failed: ${error.message}`);
  }
});

app.get('/', (req, res) => {
  res.send('Leshiy Media Converter is ready!');
});

module.exports = { fetch: app };
