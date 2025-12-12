const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();

// Используем /tmp — гарантированно доступен в Docker
const upload = multer({ dest: '/tmp/uploads/' });

app.post('/convert', upload.single('audio'), async (req, res) => {
  try {
    const inputPath = req.file.path;
    const outputPath = inputPath + '.mp3';

    // Конвертируем OGG → MP3
    const command = `ffmpeg -i "${inputPath}" -ar 22050 -ac 1 -b:a 64k "${outputPath}"`;
    await exec(command);

    // Проверяем, что файл создан
    if (!fs.existsSync(outputPath)) {
      throw new Error('MP3 file was not created');
    }

    const mp3Buffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(mp3Buffer);

    // Удаляем временные файлы
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).send('Failed to convert audio');
  }
});

app.get('/', (req, res) => {
  res.send('OGG → MP3 converter is ready!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  // Создаём папку /tmp/uploads при старте (на всякий случай)
  const tmpUploadDir = '/tmp/uploads';
  if (!fs.existsSync(tmpUploadDir)) {
    fs.mkdirSync(tmpUploadDir, { recursive: true });
  }
  console.log(`Server running on port ${port}`);
});
