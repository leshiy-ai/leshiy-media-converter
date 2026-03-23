//const nodeCrypto = require('crypto');
//const worker = require('./server'); // Подключаем твой основной код конвертера
//const fetch = require('node-fetch');
const serverless = require('serverless-http');
const app = require('./server');

/*/ Глобальные пропсы для имитации среды Cloudflare/Browser
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;
global.crypto = nodeCrypto; // Для генерации хешей/айдишников внутри конвертера

module.exports.handler = async (event, context) => {
    // 1. Парсинг входящего тела
    let body = {};
    try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    } catch (e) {
        body = event.body;
    }

    // 2. Сборка URL (чтобы конвертер понимал пути)
    const uri = event.url || event.headers['x-envoy-original-path'] || '/';
    const domain = process.env.APP_DOMAIN || "d5dtt5rfr7nk66bbrec2.kf69zffa.apigw.yandexcloud.net/converter";
    const fullUrl = `https://${domain}${uri}`;

    // 3. Создание объекта Request (имитируем Fetch API для воркера)
    const requestOptions = {
        method: event.httpMethod,
        headers: event.headers,
    };

    if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD' && event.body) {
        requestOptions.body = event.isBase64Encoded 
            ? Buffer.from(event.body, 'base64') 
            : event.body;
    }

    const request = new fetch.Request(fullUrl, requestOptions);

    // 4. Окружение (ENV)
    // Сюда прокидываем все ключи, которые конвертер ждет в env
    const env = {
        ...process.env,
        // тут можно будет подключить адаптер, как в Хранилке.
    };

    const ctx = { 
        waitUntil: (promise) => promise 
    };

    // 5. ЗАПУСК КОНВЕРТЕРА
    try {
        // Вызываем fetch-обработчик твоего server.js
        // ВНИМАНИЕ: Проверь, как экспортируется функция в server.js. 
        // Если там export default { fetch... }, то пишем worker.default.fetch
        const response = await (worker.fetch ? worker.fetch(request, env, ctx) : worker.worker_code_fetch(request, env, ctx));
        
        // 6. Формирование ответа для Яндекса
        const responseText = await response.text();
        const responseHeaders = {};
        response.headers.forEach((v, k) => { responseHeaders[k] = v; });

        return {
            statusCode: response.status || 200,
            headers: responseHeaders,
            body: responseText,
            isBase64Encoded: false
        };

    } catch (err) {
        console.error("CRITICAL ERROR:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message, stack: err.stack })
        };
    }
};
*/
// Мы говорим serverless-http, что наше приложение живёт по пути /converter.
// Он будет автоматически убирать этот префикс из URL,
// и ваше приложение в server.js будет видеть пути как и раньше (например, /debug).
// Указываем библиотеке, что мы работаем за префиксом
const handler = serverless(app, {
    basePath: '/converter'
});

module.exports.handler = async (event, context) => {
    // 1. Логируем для отладки (посмотри это в консоли Яндекса -> Логи)
    console.log('Original Path:', event.url || event.path);
    console.log('Proxy Param:', event.params?.proxy);

    // 2. Если Гетвей прислал кракозябры, чиним их ПРЯМО в объекте
    // Яндекс иногда дублирует путь в разных полях
    const actualProxy = event.params?.proxy || "";
    
    const fixPath = (pathStr) => {
        if (!pathStr) return pathStr;
        return pathStr.replace(/%7Bproxy\+%7D/g, actualProxy).replace(/{proxy\+}/g, actualProxy);
    };

    if (event.url) event.url = fixPath(event.url);
    if (event.path) event.path = fixPath(event.path);

    try {
        // 3. Вызываем Express через прослойку
        const response = await handler(event, context);
        
        // Гарантируем формат ответа для Яндекс API Gateway
        return {
            statusCode: response.statusCode,
            headers: response.headers,
            body: response.body,
            isBase64Encoded: response.isBase64Encoded || false
        };
    } catch (err) {
        console.error('SERVERLESS_ERROR:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error', message: err.message })
        };
    }
};