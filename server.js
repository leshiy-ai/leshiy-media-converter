const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Создаём папку uploads, если её нет
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.post('/convert', upload.single('audio'), async (req, res) => {
  try {
    const inputPath = req.file.path;
    const outputPath = inputPath + '.mp3';

    // Конвертируем OGG в MP3
    const command = `ffmpeg -i "${inputPath}" -ar 22050 -ac 1 -b:a 64k "${outputPath}"`;
    await exec(command);

    // Читаем MP3
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
  console.log(`Listening on port ${port}`);
});
