'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'crm_store.json');

const CRM_PASSWORD = process.env.CRM_PASSWORD || '7417';
const AUTH_TOKEN = 'td_auth_' + Buffer.from(CRM_PASSWORD + '_topordorf_salt').toString('hex');

// MIME-типы файлов
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
};

// Функция расчета относительных дат для демо-данных
function dateOffset(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Первоначальные данные при первом запуске
function getSeedState() {
  const today = dateOffset(0);
  const rows = [
    ['З-0101', 'Александр', 'Волк и Сварог', 'В производстве', 3, 'Согласован', 15000, 2000, 5000, 500, 10000, 'Обычный', 'Топор с вырезом. С одной стороны — волк, с другой — Сварог.\nВоронение, кожаная оплётка. Чехол и деревянный короб.'],
    ['З-0102', 'Михаил', 'Охота · медведь и лось', 'Подготовить эскиз', -2, 'Подготовить', 15000, 0, 0, 500, 7500, 'Срочно', 'Две стороны: медведь и лось.\nБелый фон, крупные заполненные формы, без мелкой штриховки.'],
    ['З-0103', 'Анна', 'Отцу от сына', 'Подготовить эскиз', 5, 'Отправлен клиенту', 15000, 2000, 5000, 500, 12000, 'Обычный', 'Русская деревня. Надпись «Отцу от сына».\nСохранить небольшой белый отступ внутри контура.'],
    ['З-0104', 'Дмитрий', 'СССР · память поколений', 'Готов', 0, 'Согласован', 18000, 2000, 0, 500, 20500, 'Срочно', 'Топор с вырезом. Тематика СССР на двух сторонах.\nПроверить гравировку, подготовить к отправке.'],
    ['З-0105', 'Сергей', 'Велес · хранитель леса', 'В производстве', 7, 'Согласован', 15000, 0, 5000, 500, 10000, 'Обычный', 'Велес и медвежья лапа. Воронение.\nДеревянный короб, без чехла.'],
    ['З-0106', 'Игорь', 'Дракон · две стороны', 'Новый', 12, 'Нет эскиза', 17000, 2000, 0, 500, 0, 'Обычный', 'Величественный дракон на обеих сторонах.\nСначала подготовить эскиз для согласования.'],
    ['З-0107', 'Николай', 'Рыбалка и Варяги', 'Ожидает оплаты', -1, 'Готов', 15000, 0, 0, 500, 7500, 'Обычный', 'Одна сторона — рыбалка, вторая — Варяги.\nНадпись «На благое дело».'],
    ['З-0100', 'Павел', 'Лев · подарок', 'Закрыт', -5, 'Согласован', 15000, 2000, 5000, 500, 22500, 'Обычный', 'Величественный лев. Заказ выполнен и передан.']
  ];

  const orders = rows.map(r => ({
    id: r[0], client: r[1], theme: r[2], status: r[3], due: dateOffset(r[4]),
    sketch: r[5], axe: r[6], sheath: r[7], box: r[8], shipping: r[9], paid: r[10],
    priority: r[11], task: r[12], created: dateOffset(-8), contact: '', delivery: 'СДЭК',
    address: '', folder: '', image: '', note: '', history: ['Тестовый заказ создан']
  }));

  const ledger = [
    { date: dateOffset(-5), type: 'earned', amount: 9500, note: 'Гравировка · 2 заказа', order: '' },
    { date: dateOffset(-4), type: 'paid', amount: 12500, note: 'Перевод Диме', order: '' },
    { date: dateOffset(-2), type: 'earned', amount: 7000, note: 'Завершённая работа', order: 'З-0104' }
  ];

  return {
    orders,
    ledger,
    sequence: 108,
    version: 1,
    updatedAt: new Date().toISOString()
  };
}

// Загрузка и сохранение хранилища
function loadStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.orders) && Array.isArray(data.ledger)) {
        return data;
      }
    }
  } catch (err) {
    console.error('Ошибка чтения CRM хранилища:', err.message);
  }
  const seed = getSeedState();
  saveStore(seed);
  return seed;
}

function saveStore(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    data.updatedAt = new Date().toISOString();
    const tmpPath = path.join(DATA_DIR, `crm_store.tmp.${Date.now()}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
    return data;
  } catch (err) {
    console.error('Ошибка сохранения CRM хранилища:', err.message);
    throw err;
  }
}

// Парсинг JSON тела запроса
function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
      if (body.length > 10 * 1024 * 1024) { // Ограничение 10MB
        req.destroy();
        reject(new Error('Размер запроса превышает лимит'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Некорректный JSON в теле запроса'));
      }
    });
    req.on('error', reject);
  });
}

// Вспомогательный класс вывода ответа
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function sendCors(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
}

// Создание HTTP сервера
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS предзапрос
  if (method === 'OPTIONS') {
    return sendCors(res);
  }

  // --- REST API МАРШРУТЫ ---
  if (pathname.startsWith('/api/')) {
    try {
      // POST /api/login — авторизация по паролю
      if (pathname === '/api/login' && method === 'POST') {
        const body = await parseJSONBody(req);
        if (body && String(body.password).trim() === String(CRM_PASSWORD).trim()) {
          return sendJSON(res, 200, { success: true, token: AUTH_TOKEN });
        } else {
          return sendJSON(res, 401, { success: false, error: 'Неверный пароль' });
        }
      }

      // Проверка авторизации для остальных API запросов
      const clientToken = req.headers['x-crm-token'] || parsedUrl.query.token;
      if (clientToken !== AUTH_TOKEN) {
        return sendJSON(res, 401, { error: 'Требуется авторизация', requireAuth: true });
      }

      // GET /api/state — получение полного состояния
      if (pathname === '/api/state' && method === 'GET') {
        const store = loadStore();
        return sendJSON(res, 200, store);
      }

      // POST /api/state — полное обновление состояния
      if (pathname === '/api/state' && method === 'POST') {
        const body = await parseJSONBody(req);
        if (!body || !Array.isArray(body.orders) || !Array.isArray(body.ledger)) {
          return sendJSON(res, 400, { error: 'Неверный формат состояния. Ожидались массивы orders и ledger.' });
        }
        const current = loadStore();
        current.orders = body.orders;
        current.ledger = body.ledger;
        if (body.sequence) current.sequence = Number(body.sequence);
        saveStore(current);
        return sendJSON(res, 200, { success: true, updatedAt: current.updatedAt });
      }

      // POST /api/reset — сброс данных к демо-состоянию
      if (pathname === '/api/reset' && method === 'POST') {
        const seed = getSeedState();
        saveStore(seed);
        return sendJSON(res, 200, { success: true, message: 'Демо-данные восстановлены', state: seed });
      }

      // Неизвестный API эндоинт
      return sendJSON(res, 404, { error: 'API endpoint not found' });
    } catch (err) {
      console.error('Ошибка сервера API:', err);
      return sendJSON(res, 500, { error: err.message || 'Внутренняя ошибка сервера' });
    }
  }

  // --- СТАТИЧЕСКИЕ ФАЙЛЫ ---
  if (method === 'GET' || method === 'HEAD') {
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\' || safePath === '.') safePath = 'index.html';
    while (safePath.startsWith('/') || safePath.startsWith('\\')) {
      safePath = safePath.slice(1);
    }
    if (!safePath) safePath = 'index.html';

    const filePath = path.join(__dirname, safePath);

    // Безопасность: проверяем, что запрос не выходит за пределы директории приложения
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403 Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });

      if (method === 'HEAD') return res.end();

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
    return;
  }

  res.writeHead(450, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method Not Allowed');
});

// Получение локальных IP-адресов
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// Запуск сервера
server.listen(PORT, HOST, () => {
  const ips = getLocalIPs();
  console.log('\n==================================================');
  console.log('🚀 CRM-сервер «ТопорДорф» успешно запущен!');
  console.log(`💻 На этом компьютере (локально): http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log('📱 Для входа с телефона (подключитесь к Wi-Fi сети):');
    ips.forEach(ip => console.log(`   👉 http://${ip}:${PORT}`));
  }
  console.log('==================================================\n');
});
