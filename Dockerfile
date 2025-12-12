# Стадия 1: берем готовый FFmpeg с поддержкой всего
FROM jrottenberg/ffmpeg:5-alpine AS ffmpeg

# Стадия 2: наш Node.js сервер
FROM node:18-alpine

# Копируем FFmpeg из первой стадии
COPY --from=ffmpeg /usr/local /usr/local

# Убедимся, что ffmpeg в PATH
ENV PATH="/usr/local/bin:${PATH}"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
