# ⚡ Leshiy Media Converter

Универсальный медиа-конвертер, размещённый на [Yandex.Cloud](https://cloud.yandex.ru/).

Преобразует аудио, видео и изображения в форматы, удобные для TTS, Whisper, аватаров и Telegram-ботов.

* 🚀 **Работает на Yandex.Cloud Serverless Containers**
* 🔌 **Поддерживает OGG, PCM, MP4, JPG/PNG**
* ⚡ **Быстро, без GPU, на базе FFmpeg**

*   Конвертация аудио из OGG в MP3.
*   Поворот изображений и видео.
*   Извлечение стоп-кадра из видео.
*   Извлечение аудиодорожки из видео (MP3).
*   Конвертация сырых аудиоданных (PCM) в MP3.
*   Создание GIF-анимаций и видео-стикеров из видео.
*   Изменение разрешения (ресайз) видео и изображений.
---

## Развертывание

Проект упакован в Docker-контейнер и предназначен для запуска в соответствующем окружении (например, Yandex Serverless Containers). 

## 🔗 URL сервиса

[https://d5dtt5rfr7nk66bbrec2.kf69zffa.apigw.yandexcloud.net/converter](https://d5dtt5rfr7nk66bbrec2.kf69zffa.apigw.yandexcloud.net/converter)

Приложение запускает Express-сервер на порту, указанном в переменной окружения `PORT`. Если переменная `PORT` не задана, по умолчанию используется порт 8080.

---

## 📥 Эндпоинты API

### 1. Проверка и Отладка

| Эндпоинт | Метод | Описание | Выход |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | Проверка работоспособности сервиса. | `Leshiy Media Converter is ready!` |
| `/debug` | `GET` | Информация о версии и конфигурации FFmpeg (включая `--enable-libopus`). | Полная информация о FFmpeg |

### 2. Аудио-Конвертация

| Эндпоинт | Метод | Описание | Вход | Выход | Использование |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/ogg2mp3` | `POST` | Голосовые сообщения (Telegram) → MP3. | `audio/ogg` (OPUS) | `audio/mpeg` (22050 Гц, моно, 64 кбит/с) | Транскрипция через Whisper. |
| `/wav2mp3` | `POST` | Голосовые сообщения (Web и App) → MP3. | `audio/wav` | `audio/mpeg` (22050 Гц, моно, 64 кбит/с) | Голосовое в экосистеме или WAV-файл. |
| `/pcm2mp3` | `POST` | Сырые аудиобайты (PCM) → MP3. | `application/octet-stream` | `audio/mpeg` | Конвертация вывода TTS-сервисов (Gemini, ElevenLabs). |
| `/video2mp3` | `POST` | Видео → MP3 (Извлечение аудио). | `multipart/form-data` | `audio/mpeg` (22050 Гц, 128 кбит/с) | Извлечение аудиодорожки. |

**Параметры `/pcm2mp3` (опционально):** `sampleRate`, `channels`, `format` (по умолчанию: `24000`, `1`, `s16le`).

### 3. Обработка Изображений и Видео

| Эндпоинт | Метод | Описание | Формат входа | Параметры |
| :--- | :--- | :--- | :--- | :--- |
| `/rotate-image` | `POST` | Поворот изображения. | JPG, PNG | `angle` (90, -90, 180) |
| `/rotate-video` | `POST` | Поворот видео. | MP4 и др. | `angle` (90, -90, 180) |
| `/resize-image` | `POST` | Изменение размера изображения. | JPG, PNG и др. | `resolution` (240p до 2160p) |
| `/resize-video` | `POST` | Изменение разрешения видео. | MP4 и др. | `resolution` (240p до 2160p) |
| `/video2gif` | `POST` | Создание GIF или видео-стикера из фрагмента видео. | MP4 и др. | `start`, `end`, `format` (gif/mp4), `width`, `fps` |
| `/gif2video` | `POST` | Преобразование анимированного GIF → MP4. | GIF | |

#### 📸 Эндпоинт: Стоп-кадр из видео (`/video2image`)

| Описание | Параметры | Формат выхода | Использование |
| :--- | :--- | :--- | :--- |
| Создание стоп-кадра из видео. | `timestamp` (HH:MM:SS.mmm), `format` (jpg/png) | JSON-объект с полями `image` (Base64), `width`, `height`, `format`. | Превью, анализ кадров, подготовка к I2I. |

---

## 🛠 Технические детали

* **Среда:** `Node.JS:22` (в виде Serverless-функции Yandex.Cloud).
* **FFmpeg:** Версия 5.1.8 (из официального репозитория Debian).
* **Безопасность:** Имена временных файлов генерируются случайно, исключается `path traversal`.

### ⚠️ Ограничения (Yandex.Cloud Functions)

| Ресурс | Лимит |
| :--- | :--- |
| RAM | до 2048 МБ (сконфигурировано) |
| Таймаут запроса | до 600 секунд (сконфигурировано) |
| Размер файла | до 3.5 МБ (API Gateway) |

## 🚀 Состояние деплоя

Деплой происходит автоматически через GitHub Actions при пуше в `main` ветку.

Следить за процессом можно на вкладке **Actions** вашего репозитория.

---

## 💡 Примеры использования (curl)

```bash
# Поворот изображения:
curl -X POST "https://d5dtt5rfr7nk66bbrec2.kf69zffa.apigw.yandexcloud.net/converter/rotate-image?angle=90" \
 -F "image=@photo.jpg" \
 -o rotated.jpg

# PCM → MP3:
curl -X POST "https://d5dtt5rfr7nk66bbrec2.kf69zffa.apigw.yandexcloud.net/converter/pcm2mp3?sampleRate=24000" \
 -H "Content-Type: application/octet-stream" \
 --data-binary @speech.pcm \
 -o output.mp3
```
---
  
## 📦 Зависимости

* express
* multer
* serverless-http
* ffmpeg (установлен в Dockerfile)

---

## 📜 Лицензия
MIT © Leshiy (Огорельцев Александр Валерьевич)
