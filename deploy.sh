#!/usr/bin/env bash
set -e
echo '=================================================='
echo '🚀 Автоматическое развертывание CRM ТопорДорф'
echo '=================================================='

TARGET_DIR='/var/www/topordorf-crm'
mkdir -p "$TARGET_DIR/data"
cd "$TARGET_DIR"

cat << 'EOF_FILE_server_js' > "$TARGET_DIR/server.js"
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
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';

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

EOF_FILE_server_js

cat << 'EOF_FILE_index_html' > "$TARGET_DIR/index.html"
<!doctype html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#182320"><meta name="description" content="Личная CRM мастерской ТопорДорф — заказы, эскизы и взаиморасчёты."><title>ТопорДорф · Заказы мастерской</title><link rel="stylesheet" href="styles.css"><script defer src="app.js"></script></head>
<body>
<aside class="sidebar"><a class="brand" href="#orders"><span class="brand-symbol">ТД</span><span>ТОПОРДОРФ<small>МАСТЕРСКАЯ · CRM</small></span></a><div class="nav-label">РАБОЧЕЕ ПРОСТРАНСТВО</div><nav id="navigation" aria-label="Разделы CRM"></nav><div class="side-note"><span class="small-line"></span><strong>Всё начинается<br>с хорошего замысла.</strong><p>А продолжается порядком<br>в делах мастерской.</p></div><div class="owner"><span class="avatar">М</span><div>Моя мастерская<small>Личный кабинет</small></div></div></aside>
<div class="workspace"><header class="topbar"><span id="breadcrumb">Мастерская <span>/</span> Заказы</span><div class="top-right"><span id="today"></span><span class="private-label">Личный доступ</span></div></header><main><div class="demo-banner"><span><b>Локальный режим</b> · Данные сохраняются в браузере.</span><div class="banner-actions"><button id="export-json" class="text-button" title="Скачать резервную копию заказов и взаиморасчетов в формате JSON">Скачать JSON</button><label id="import-json-label" class="text-button" style="cursor:pointer" title="Загрузить сохраненную базу из JSON">Загрузить JSON<input type="file" id="import-json" accept=".json" style="display:none"></label><button id="reset" class="text-button" title="Сбросить к первоначальным демо-примерам">Сбросить</button></div></div><div id="content"></div></main><footer>ТОПОРДОРФ <span>Порядок в заказах. Внимание к деталям.</span><span>Прототип · 01</span></footer></div>
<dialog id="order-dialog" class="order-dialog" aria-labelledby="order-title"><div id="order-body"></div></dialog>
<dialog id="small-dialog" class="small-dialog" aria-labelledby="small-title"><div id="small-body"></div></dialog>
<dialog id="sketch-dialog" class="order-dialog sketch-dialog" aria-labelledby="sketch-title"></dialog>
<div id="toast" role="status" aria-live="polite"></div>
</body></html>

EOF_FILE_index_html

cat << 'EOF_FILE_app_js' > "$TARGET_DIR/app.js"
'use strict';
const paths={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',orders:'M8 4H4v17h16V4h-4 M9 2h6v4H9z M8 11h8 M8 16h5',sketch:'M4 20l4-1L20 7l-3-3L5 16z M14 7l3 3 M4 20h16',wallet:'M3 6h16v14H3z M3 6V4h13v2 M15 11h6v5h-6z M17 13h1',archive:'M3 3h18v5H3z M5 8v13h14V8 M9 12h6',plus:'M12 5v14 M5 12h14',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',check:'M5 12l4 4L19 6',arrow:'M5 12h14 M14 7l5 5-5 5',folder:'M3 5h7l2 3h9v12H3z',copy:'M8 8h12v13H8z M16 8V3H3v13h5',image:'M3 3h18v18H3z M3 16l5-5 4 4 3-3 6 6 M16 7h.01',info:'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'};
const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n]||paths.orders}"/></svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rub=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n)+' ₽';
const day=new Date();day.setHours(12,0,0,0);
const dateOffset=n=>{let d=new Date(day);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const today=dateOffset(0);
const dateLabel=s=>s?new Date(s+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'}).replace('.',''):'Без срока';
const statuses=["Новый", "Подготовить эскиз", "На отправку оплачен", "Ожидает оплаты", "В производстве", "Готов", "Отправлен", "Закрыт", "Наклеен", "Отказ", "у Димы", "Наклейка готова", "Видео отправлено"];
const classes=statuses.map((_,i)=>"order-status-"+i);
const statusColors=["#e8eaed", "#e6cff2", "#62f870", "#ffe700", "#e6cff2", "#20e633", "#045ce0", "#215a6c", "#e8eaed", "#b10202", "#0df8f8", "#ffe5a0", "#ffe5a0"];
const statusTextColors=statuses.map((_,i)=>[6,7,9].includes(i)?"#ffffff":"#182320");
const sketchStatuses=['Нет эскиза','Подготовить','Отправлен клиенту','На правках','Готов','Согласован'];
const views=[['home','Обзор','grid'],['orders','Заказы','orders'],['sketches','Эскизы','sketch'],['money','Взаиморасчёты','wallet'],['archive','Архив','archive']];
const total=o=>Number(o.axe)+Number(o.sheath)+Number(o.box)+Number(o.shipping);
const debt=o=>Math.max(0,total(o)-Number(o.paid));
const active=o=>!['Закрыт','Отказ'].includes(o.status);
const overdue=o=>active(o)&&o.due&&o.due<today;
const needsSketch=o=>active(o)&&!['Готов','Согласован'].includes(o.sketch);
let orders=[],ledger=[],view='orders',tab='all',query='',statusFilter='',sequence=108;
const STORAGE_KEY='topordorf_crm_data_v1';
const AUTH_KEY='topordorf_crm_auth_token';
let lastServerTimestamp='';
let isOnline=false;

function getAuthHeaders(){
 const token=localStorage.getItem(AUTH_KEY)||'';
 return {'Content-Type':'application/json','x-crm-token':token};
}

function promptAuthDialog(){
 const smallDialog=document.getElementById('small-dialog');
 if(!smallDialog||smallDialog.open)return;
 document.getElementById('small-body').innerHTML=`
  <form id="auth-form">
   <div class="dialog-head">
    <h2 id="small-title">🔑 Вход в ТопорДорф CRM</h2>
   </div>
   <div class="dialog-content">
    <p class="field-hint" style="margin-bottom:14px">Введите пароль мастерской для синхронизации.</p>
    <label class="field full">Пароль
     <input type="password" id="auth-pass-input" placeholder="Введите пароль..." required autofocus autocomplete="current-password">
    </label>
    <p id="auth-error-msg" style="color:#b10202;font-size:12px;margin-top:8px" hidden></p>
   </div>
   <div class="dialog-actions">
    <span></span>
    <button class="button primary" type="submit">Войти</button>
   </div>
  </form>`;
 smallDialog.showModal();
 document.getElementById('auth-form').onsubmit=async e=>{
  e.preventDefault();
  const pass=document.getElementById('auth-pass-input').value;
  try{
   const res=await fetch('/api/login',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({password:pass})
   });
   const data=await res.json();
   if(res.ok&&data.token){
    localStorage.setItem(AUTH_KEY,data.token);
    smallDialog.close();
    toast('Успешная авторизация');
    fetchServerState();
   }else{
    const errEl=document.getElementById('auth-error-msg');
    if(errEl){errEl.textContent=data.error||'Неверный пароль';errEl.hidden=false;}
   }
  }catch{
   toast('Ошибка соединения при входе');
  }
 };
}

function setOnlineStatus(online){
 isOnline=online;
 const badge=document.querySelector('.private-label');
 if(badge){
  badge.textContent=online?'🟢 Онлайн (Сервер)':'🟡 Локально (Браузер)';
  badge.title=online?'Синхронизировано с сервером мастерской':'Автономный режим (сохранение в браузере)';
 }
}

function saveState(){
 const updatedAt=new Date().toISOString();
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify({orders,ledger,sequence,version:1,updatedAt}))}catch(err){console.error('Ошибка сохранения state:',err)}
 syncToServer({orders,ledger,sequence,updatedAt});
}

async function syncToServer(payload){
 try{
  const res=await fetch('/api/state',{
   method:'POST',
   headers:getAuthHeaders(),
   body:JSON.stringify(payload)
  });
  if(res.status===401){
   setOnlineStatus(false);
   promptAuthDialog();
   return;
  }
  if(res.ok){
   const data=await res.json();
   if(data.updatedAt)lastServerTimestamp=data.updatedAt;
   setOnlineStatus(true);
  }
 }catch(err){
  setOnlineStatus(false);
 }
}

async function fetchServerState(){
 try{
  const res=await fetch('/api/state',{headers:getAuthHeaders()});
  if(res.status===401){
   setOnlineStatus(false);
   promptAuthDialog();
   return;
  }
  if(res.ok){
   const data=await res.json();
   if(data&&Array.isArray(data.orders)&&Array.isArray(data.ledger)){
    orders=data.orders;ledger=data.ledger;sequence=Number(data.sequence)||108;
    if(data.updatedAt)lastServerTimestamp=data.updatedAt;
    localStorage.setItem(STORAGE_KEY,JSON.stringify({orders,ledger,sequence,version:1,updatedAt:data.updatedAt}));
    setOnlineStatus(true);
    render();
   }
  }
 }catch(err){
  setOnlineStatus(false);
 }
}

async function checkServerUpdates(){
 try{
  const res=await fetch('/api/state',{headers:getAuthHeaders()});
  if(res.status===401){
   setOnlineStatus(false);
   return;
  }
  if(res.ok){
   const data=await res.json();
   setOnlineStatus(true);
   if(data.updatedAt&&data.updatedAt!==lastServerTimestamp){
    lastServerTimestamp=data.updatedAt;
    orders=data.orders;ledger=data.ledger;sequence=Number(data.sequence)||108;
    localStorage.setItem(STORAGE_KEY,JSON.stringify({orders,ledger,sequence,version:1,updatedAt:data.updatedAt}));
    render();
   }
  }
 }catch(err){
  setOnlineStatus(false);
 }
}

function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return false;const data=JSON.parse(raw);if(data&&Array.isArray(data.orders)&&Array.isArray(data.ledger)){orders=data.orders;ledger=data.ledger;sequence=Number(data.sequence)||108;return true}}catch(err){console.error('Ошибка восстановления state:',err)}return false}
function initData(){if(!loadState()){seed();saveState()}fetchServerState();}
function seed(){
 const rows=[
 ['З-0101','Александр','Волк и Сварог','В производстве',3,'Согласован',15000,2000,5000,500,10000,'Обычный','Топор с вырезом. С одной стороны — волк, с другой — Сварог.\nВоронение, кожаная оплётка. Чехол и деревянный короб.'],
 ['З-0102','Михаил','Охота · медведь и лось','Подготовить эскиз',-2,'Подготовить',15000,0,0,500,7500,'Срочно','Две стороны: медведь и лось.\nБелый фон, крупные заполненные формы, без мелкой штриховки.'],
 ['З-0103','Анна','Отцу от сына','Подготовить эскиз',5,'Отправлен клиенту',15000,2000,5000,500,12000,'Обычный','Русская деревня. Надпись «Отцу от сына».\nСохранить небольшой белый отступ внутри контура.'],
 ['З-0104','Дмитрий','СССР · память поколений','Готов',0,'Согласован',18000,2000,0,500,20500,'Срочно','Топор с вырезом. Тематика СССР на двух сторонах.\nПроверить гравировку, подготовить к отправке.'],
 ['З-0105','Сергей','Велес · хранитель леса','В производстве',7,'Согласован',15000,0,5000,500,10000,'Обычный','Велес и медвежья лапа. Воронение.\nДеревянный короб, без чехла.'],
 ['З-0106','Игорь','Дракон · две стороны','Новый',12,'Нет эскиза',17000,2000,0,500,0,'Обычный','Величественный дракон на обеих сторонах.\nСначала подготовить эскиз для согласования.'],
 ['З-0107','Николай','Рыбалка и Варяги','Ожидает оплаты',-1,'Готов',15000,0,0,500,7500,'Обычный','Одна сторона — рыбалка, вторая — Варяги.\nНадпись «На благое дело».'],
 ['З-0100','Павел','Лев · подарок','Закрыт',-5,'Согласован',15000,2000,5000,500,22500,'Обычный','Величественный лев. Заказ выполнен и передан.']];
 orders=rows.map(r=>({id:r[0],client:r[1],theme:r[2],status:r[3],due:dateOffset(r[4]),sketch:r[5],axe:r[6],sheath:r[7],box:r[8],shipping:r[9],paid:r[10],priority:r[11],task:r[12],created:dateOffset(-8),contact:'',delivery:'СДЭК',address:'',folder:'',image:'',note:'',history:['Тестовый заказ создан']}));
 ledger=[{date:dateOffset(-5),type:'earned',amount:9500,note:'Гравировка · 2 заказа',order:''},{date:dateOffset(-4),type:'paid',amount:12500,note:'Перевод Диме',order:''},{date:dateOffset(-2),type:'earned',amount:7000,note:'Завершённая работа',order:'З-0104'}];sequence=108;
}
initData();
setInterval(checkServerUpdates,6000);
window.addEventListener('focus',checkServerUpdates);
document.getElementById('today').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3400)}
function badge(o){return `<span class="badge ${classes[statuses.indexOf(o.status)]||'new'}">${esc(o.status)}</span>`}
function nav(){document.getElementById('navigation').innerHTML=views.map(([id,title,ico])=>`<a href="#${id}" class="${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(ico)}${title}${id==='orders'?`<span class="count">${orders.filter(active).length}</span>`:''}</a>`).join('');document.getElementById('breadcrumb').innerHTML=`Мастерская <span>/</span> ${views.find(x=>x[0]===view)?.[1]||'Заказы'}`}
function stats(){const a=orders.filter(active);return `<div class="stats"><div class="stat selected"><div class="stat-label">В работе ${icon('orders')}</div><div class="stat-value">${a.length}<span style="font-size:14px;font-weight:400;letter-spacing:0;margin-left:9px">заказов</span></div><div class="stat-note">${a.filter(o=>o.status==='В производстве').length} в производстве</div></div><div class="stat"><div class="stat-label">Нужен эскиз ${icon('sketch')}</div><div class="stat-value">${a.filter(needsSketch).length}</div><div class="stat-note">Подготовить или согласовать</div></div><div class="stat"><div class="stat-label">Просрочено ${icon('clock')}</div><div class="stat-value">${a.filter(overdue).length}</div><div class="stat-note warn">${a.filter(o=>o.due===today).length} со сроком сегодня</div></div><div class="stat"><div class="stat-label">Остаток к оплате ${icon('wallet')}</div><div class="stat-value">${rub(a.reduce((s,o)=>s+debt(o),0))}</div><div class="stat-note">По активным заказам</div></div></div>`}
function pageHead(title,sub,button=true){return `<div class="page-head"><div><div class="eyebrow">МОЯ МАСТЕРСКАЯ</div><h1>${title}</h1><p class="subtitle">${sub}</p></div>${button?`<button class="button primary" data-action="new">${icon('plus')} Новый заказ</button>`:''}</div>`}
function filtered(){return orders.filter(o=>(view==='archive'?!active(o):active(o))&&(tab!=='urgent'||o.priority==='Срочно'||overdue(o))&&(tab!=='ready'||o.status==='Готов')&&(!statusFilter||o.status===statusFilter)&&(!query||[o.id,o.client,o.theme,o.task,o.contact].join(' ').toLowerCase().includes(query.toLowerCase())))}
function rowsHTML(rows){if(!rows.length)return `<div class="empty"><h3>Заказов не найдено</h3><p>Измените фильтры или создайте новый заказ.</p><button class="button" data-action="clear">Сбросить фильтры</button></div>`;return `<table class="order-table"><thead><tr><th>ЗАКАЗ / КЛИЕНТ</th><th>ТЕЛЕФОН</th><th class="theme-col">ЗАМЫСЕЛ</th><th>СТАТУС</th><th>СРОК</th><th>СТОИМОСТЬ / ОСТАТОК</th><th></th></tr></thead><tbody>${rows.map(o=>`<tr data-order-id="${o.id}"><td class="order-main"><div class="order-cell"><button class="drag-handle" type="button" data-drag="${o.id}" aria-label="Переместить ${esc(o.id)}" title="Перетащите строку или используйте стрелки вверх и вниз"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h1 M15 5h1 M8 12h1 M15 12h1 M8 19h1 M15 19h1"/></svg></button><span class="monogram">${esc(o.client.slice(0,1))}</span><div><button class="order-name" data-open="${o.id}">${esc(o.client)}</button><div class="meta"><span class="order-id">${esc(o.id)}</span>${o.priority==='Срочно'?'<span class="priority">Срочно</span>':''}</div></div></td><td class="phone-col"><span class="mobile-label">Телефон:</span>${phoneHTML(o.contact)}</td><td class="theme-col"><div class="theme">${esc(o.theme||'Без названия')}</div><div class="meta">${esc(o.sketch)}</div></td><td class="status-col">${inlineStatus(o)}</td><td class="due-col"><div class="due ${overdue(o)?'late':''}"><span class="mobile-label">Срок:</span>${dateLabel(o.due)}</div><div class="meta">${overdue(o)?'Срок прошёл':o.due===today&&active(o)?'Сегодня':''}</div></td><td class="money-col"><div class="money">${rub(total(o))}</div><div class="meta ${debt(o)===0?'paid':''}">${debt(o)===0?(o.paid>total(o)?'Переплата '+rub(o.paid-total(o)):'Оплачено'):'Остаток '+rub(debt(o))}</div></td><td class="open-col"><button class="row-open" data-open="${o.id}" aria-label="Открыть ${esc(o.id)}"><span class="open-order-label">Открыть заказ</span><span aria-hidden="true">›</span></button></td></tr>`).join('')}</tbody></table>`}
function updateList(){const rows=filtered();document.getElementById('table-area').innerHTML=rowsHTML(rows);document.getElementById('result-count').textContent=`Показано ${rows.length} из ${orders.filter(o=>view==='archive'?!active(o):active(o)).length} заказов`}
function ordersPage(){const archive=view==='archive';return pageHead(archive?'Архив заказов':'Заказы',archive?'Завершённые заказы и отказы. Вся история под рукой.':'От первого эскиза до готового топора.')+(archive?'':stats())+`<section class="panel"><div class="toolbar"><div class="tabs" aria-label="Фильтры заказов">${(archive?[['all','Все завершённые']]:[['all','Все заказы'],['urgent','Требуют внимания'],['ready','Готовы']]).map(([id,label])=>`<button class="tab ${tab===id?'active':''}" data-tab="${id}" aria-pressed="${tab===id}">${label}${id==='all'?`<span class="tab-count">${orders.filter(o=>archive?!active(o):active(o)).length}</span>`:''}</button>`).join('')}</div><div class="filters"><div class="search">${icon('search')}<input id="search" aria-label="Поиск заказов" placeholder="Клиент, телефон, тема…" value="${esc(query)}"></div><select id="status-filter" aria-label="Статус заказа"><option value="">Все статусы</option>${statuses.filter(s=>archive?['Закрыт','Отказ'].includes(s):!['Закрыт','Отказ'].includes(s)).map(s=>statusOption(s,statusFilter)).join('')}</select></div></div><div id="table-area"></div><div class="table-foot"><span id="result-count"></span><span>Перетаскивайте строки за ручку слева</span></div></section><div class="bottom-note">${icon('folder')} ТЗ и эскизы для сотрудника — по ссылке на Google Drive</div>`}
function overview(){const attention=orders.filter(o=>overdue(o)||active(o)&&o.due===today).sort((a,b)=>a.due.localeCompare(b.due));return pageHead('Обзор мастерской','Сроки, задачи и деньги — всё на одном экране.')+stats()+`<div class="dashboard-columns"><section class="panel"><div class="panel-title"><h2>На что обратить внимание</h2></div>${attention.length?attention.map(o=>`<div class="agenda-item"><span class="monogram">${esc(o.client[0])}</span><div><button class="order-name" data-open="${o.id}">${esc(o.client)} · ${esc(o.id)}</button><div class="meta">${esc(o.theme)}</div></div><span class="due ${overdue(o)?'late':''}">${dateLabel(o.due)}</span></div>`).join(''):'<div class="empty">Срочных дел по срокам нет</div>'}</section><section class="panel"><div class="panel-title"><h2>Этапы работы</h2><span class="meta">Активные заказы</span></div><div style="padding:12px 0">${statuses.filter(s=>!['Закрыт','Отказ'].includes(s)).map(s=>{const n=orders.filter(o=>o.status===s).length;return `<div class="stage-row"><span>${s}</span><div class="stage-track"><span style="width:${n/Math.max(orders.filter(active).length,1)*100}%"></span></div><span>${n}</span></div>`}).join('')}</div></section></div>`}
function sketchesPage(){const list=orders.filter(active);return pageHead('Эскизы','Задания, правки и согласованные рисунки.').replace('<button class="button primary" data-action="new">', '<button class="button primary" data-action="create-sketch">').replace('Новый заказ</button>', 'Создать эскиз</button>')+`<div class="sketch-grid">${list.map(o=>`<article class="sketch-card">${imagePreview(o.image,true)}<div class="sketch-content"><span class="badge ${o.sketch==='Согласован'?'ready':'sketch'}">${esc(o.sketch)}</span><h3>${esc(o.theme||'Новый эскиз')}</h3><p class="meta">${esc(o.id)} · ${esc(o.client)}</p><button class="button" data-open="${o.id}">Открыть задание ${icon('arrow')}</button><button class="button primary sketch-create" data-sketch-order="${o.id}">${icon('sketch')} Создать эскиз</button></div></article>`).join('')||'<div class="empty">Пока нет активных заказов</div>'}</div>`}
function moneyPage(){const earned=ledger.filter(x=>x.type==='earned').reduce((s,x)=>s+x.amount,0),paid=ledger.filter(x=>x.type==='paid').reduce((s,x)=>s+x.amount,0),balance=earned-paid;return pageHead('Взаиморасчёты с Димой','Заработок за выполненную работу и ваши переводы.',false)+`<div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="stat"><div class="stat-label">Дима заработал</div><div class="stat-value">${rub(earned)}</div></div><div class="stat"><div class="stat-label">Вы перевели</div><div class="stat-value">${rub(paid)}</div></div><div class="stat selected"><div class="stat-label">${balance>=0?'Осталось выплатить':'Аванс у Димы'}</div><div class="stat-value">${rub(Math.abs(balance))}</div></div></div><section class="panel"><div class="toolbar"><h2>Операции</h2><div class="ledger-head"><button class="button" data-ledger="earned">${icon('plus')} Начислить</button><button class="button primary" data-ledger="paid">${icon('wallet')} Записать перевод</button></div></div><table class="ledger-table"><thead><tr><th>ДАТА</th><th>ОПЕРАЦИЯ</th><th class="ledger-note">КОММЕНТАРИЙ</th><th>СУММА</th><th></th></tr></thead><tbody>${ledger.map((x,i)=>({x,i})).sort((a,b)=>b.x.date.localeCompare(a.x.date)).map(({x,i})=>`<tr><td>${dateLabel(x.date)}</td><td class="ledger-type">${x.type==='earned'?'Начислено за работу':'Перевод Диме'}${x.order?`<div class="meta">${esc(x.order)}</div>`:''}</td><td class="ledger-note">${esc(x.note)}</td><td class="${x.type==='earned'?'positive':'negative'}">${rub(x.amount)}</td><td><button class="text-button" data-ledger-edit="${i}">Изменить</button></td></tr>`).join('')||'<tr><td colspan="5">Пока нет операций</td></tr>'}</tbody></table></section><p class="balance-note">Остаток к выплате = заработано − переведено. Оплаты клиентов учитываются в карточках заказов.</p>`}
function render(){nav();document.getElementById('content').innerHTML=view==='home'?overview():view==='sketches'?sketchesPage():view==='money'?moneyPage():ordersPage();if(view==='orders'||view==='archive')updateList()}
function setView(){const hash=location.hash.slice(1);view=views.some(x=>x[0]===hash)?hash:'orders';tab='all';query='';statusFilter='';render()}
window.addEventListener('hashchange',setView);
const orderDialog=document.getElementById('order-dialog'),smallDialog=document.getElementById('small-dialog');
let editing=null;
const input=(label,name,value,type='text',full=false,extra='')=>`<label class="field ${full?'full':''}">${label}<input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;
const select=(label,name,value,options)=>`<label class="field">${label}<select name="${name}" ${name==='status'?`style="${statusStyle(value)}"`:''}>${options.map(s=>name==='status'?statusOption(s,value):`<option ${s===value?'selected':''}>${esc(s)}</option>`).join('')}</select></label>`;
function safeURL(s){if(!s)return '';try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch{return ''}}
function openOrder(id){const existing=orders.find(o=>o.id===id);editing=existing?existing.id:null;const o=existing||{id:'Новый заказ',client:'',theme:'',contact:'',status:'Новый',priority:'Обычный',created:today,due:'',sketch:'Нет эскиза',task:'',axe:15000,sheath:0,box:0,shipping:0,paid:0,delivery:'СДЭК',address:'',folder:'',image:'',note:'',history:[]};document.getElementById('order-body').innerHTML=`<form id="order-form"><div class="dialog-head"><div><div class="eyebrow">${esc(o.id)} · КАРТОЧКА ЗАКАЗА</div><h2 id="order-title">${existing?esc(o.client):'Новый заказ'}</h2></div><button type="button" class="close" data-close="order" aria-label="Закрыть">×</button></div><div class="dialog-content"><div class="form-grid">${input('Клиент *','client',o.client,'text',false,'required maxlength="100"')}${input('Телефон','contact',o.contact,'tel',false,'maxlength="150" placeholder="+7 …"')}${input('Тема / название заказа','theme',o.theme,'text',true,'maxlength="160"')}${select('Статус заказа','status',o.status,statuses)}${select('Приоритет','priority',o.priority,['Обычный','Срочно','Низкий'])}${input('Дата принятия','created',o.created,'date')}${input('Дата готовности','due',o.due,'date')}</div><div class="section-title">Задание и эскиз</div><div class="form-grid"><label class="field full">Техническое задание<textarea name="task" maxlength="10000" placeholder="Форма топора, рисунки на обеих сторонах, надписи, отделка…">${esc(o.task)}</textarea></label>${select('Состояние эскиза','sketch',o.sketch,sketchStatuses)}${input('Ссылка на папку Google Drive','folder',o.folder,'url',false,'placeholder="https://drive.google.com/…"')}${input('Ссылка на эскиз — Google Drive или изображение','image',o.image,'url',true,'placeholder="https://drive.google.com/file/d/…/view"')}</div><p class="field-hint" style="margin-top:8px">Вставьте ссылку именно на файл эскиза. Ссылка на папку указывается отдельно.</p><div id="order-image-preview">${imagePreview(o.image)}</div><div class="copy-section"><button class="button light" type="button" data-action="copy-task">${icon('copy')} Скопировать ТЗ сотруднику</button><button class="button light" type="button" data-action="open-folder">${icon('folder')} Открыть папку</button></div><div class="section-title">Стоимость и оплата · только для вас</div><div class="form-grid four">${input('Топор, ₽','axe',o.axe,'number',false,'min="0" max="100000000" step="1" required')}${input('Чехол, ₽','sheath',o.sheath,'number',false,'min="0" max="100000000" step="1" required')}${input('Короб, ₽','box',o.box,'number',false,'min="0" max="100000000" step="1" required')}${input('Доставка, ₽','shipping',o.shipping,'number',false,'min="0" max="100000000" step="1" required')}</div><div class="form-grid" style="margin-top:18px">${input('Всего оплачено клиентом, ₽','paid',o.paid,'number',false,'min="0" max="100000000" step="1" required')}${select('Способ доставки','delivery',o.delivery,['СДЭК','Самовывоз','Ozon','Пятёрочка','Почта России','Курьер','Другое'])}</div><div id="live-total" class="total-strip"></div><div class="form-grid" style="margin-top:20px">${input('Адрес доставки','address',o.address,'text',true,'maxlength="1000"')}<label class="field full">Личные заметки<textarea name="note" maxlength="5000" placeholder="Не попадут в текст для сотрудника">${esc(o.note)}</textarea></label></div>${o.history.length?`<div class="section-title">История изменений</div><div class="history">${o.history.slice(-5).reverse().map(esc).join('<br>')}</div>`:''}</div><div class="dialog-actions">${existing?`<button class="button" type="button" data-action="archive-order">${icon('archive')} ${active(o)?'В архив':'Вернуть в работу'}</button>`:'<span></span>'}<div class="right"><button type="button" class="button" data-close="order">Отмена</button><button class="button primary" type="submit">${icon('check')} Сохранить</button></div></div></form>`;updateTotal();orderDialog.showModal()}
function draft(){const f=new FormData(document.getElementById('order-form'));const o=Object.fromEntries(f);for(const k of ['axe','sheath','box','shipping','paid'])o[k]=Number(o[k]||0);return o}
function updateTotal(){const o=draft();document.getElementById('live-total').innerHTML=`<div>Стоимость<strong>${rub(total(o))}</strong></div><div>Оплачено<strong>${rub(o.paid)}</strong></div><div>${o.paid>total(o)?'Переплата':'Остаток'}<strong>${rub(o.paid>total(o)?o.paid-total(o):debt(o))}</strong></div>`}
function saveOrder(status){const form=document.getElementById('order-form');if(!form.reportValidity())return;const o=draft();o.client=o.client.trim();if(!o.client){toast('Укажите имя клиента');return}for(const name of ['folder','image'])if(o[name]&&!safeURL(o[name])){toast('Используйте ссылку, начинающуюся с https://');return}if(status)o.status=status;const previous=orders.find(x=>x.id===editing);o.id=previous?.id||'З-'+String(sequence++).padStart(4,'0');o.history=[...(previous?.history||[]),`${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · ${previous?'Заказ обновлён':'Заказ создан'} · ${o.status}`];if(previous)orders[orders.indexOf(previous)]=o;else orders.unshift(o);saveState();orderDialog.close();render();toast('Заказ сохранён')}
async function copyTask(){const o=draft();const text=employeeTaskText(o,editing);try{await navigator.clipboard.writeText(text);toast('ТЗ скопировано — с заполненными контактами и ссылками')}catch{document.getElementById('small-body').innerHTML=`<div class="dialog-head"><h2 id="small-title">ТЗ для сотрудника</h2><button class="close" data-close="small" aria-label="Закрыть">×</button></div><div class="dialog-content"><p class="field-hint" style="margin-bottom:12px">Автокопирование недоступно. Выделите и скопируйте текст.</p><textarea class="copy-text" readonly>${esc(text)}</textarea></div>`;smallDialog.showModal();smallDialog.querySelector('textarea').select()}}
function ledgerDialog(type,index=null){const x=index===null?{type,amount:'',date:today,order:'',note:''}:ledger[index];document.getElementById('small-body').innerHTML=`<form id="ledger-form" data-index="${index??''}"><div class="dialog-head"><h2 id="small-title">${index!==null?'Изменить операцию':type==='earned'?'Начислить за работу':'Записать перевод'}</h2><button type="button" class="close" data-close="small" aria-label="Закрыть">×</button></div><div class="dialog-content"><input type="hidden" name="type" value="${x.type}"><div class="form-grid">${input('Дата','date',x.date,'date',false,'required')}${input('Сумма, ₽','amount',x.amount,'number',false,'required min="1" max="100000000" step="1"')}<label class="field full">Заказ (необязательно)<select name="order"><option value="">Без привязки к заказу</option>${orders.map(o=>`<option value="${o.id}" ${o.id===x.order?'selected':''}>${o.id} · ${esc(o.client)}</option>`).join('')}</select></label>${input('Комментарий','note',x.note,'text',true,'maxlength="500"')}</div></div><div class="dialog-actions"><button class="button" type="button" data-close="small">Отмена</button><button class="button primary" type="submit">Сохранить</button></div></form>`;smallDialog.showModal()}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.close){(b.dataset.close==='order'?orderDialog:smallDialog).close();return}if(b.dataset.open){openOrder(b.dataset.open);return}if(b.dataset.tab){tab=b.dataset.tab;render();return}if(b.dataset.ledger){ledgerDialog(b.dataset.ledger);return}if(b.dataset.ledgerEdit!==undefined){ledgerDialog('',Number(b.dataset.ledgerEdit));return}const action=b.dataset.action;if(action==='new')openOrder();if(action==='clear'){query='';statusFilter='';tab='all';render()}if(action==='copy-task')copyTask();if(action==='open-folder'){const url=safeURL(draft().folder);if(!url){toast('Сначала добавьте HTTPS-ссылку на папку');return}window.open(url,'_blank','noopener,noreferrer')}if(action==='archive-order'){const o=orders.find(x=>x.id===editing);saveOrder(active(o)?'Закрыт':'Новый')}});
document.addEventListener('input',e=>{if(e.target.id==='search'){query=e.target.value;updateList()}if(e.target.closest('#order-form')&&['axe','sheath','box','shipping','paid'].includes(e.target.name))updateTotal()});
document.addEventListener('change',e=>{if(e.target.id==='status-filter'){statusFilter=e.target.value;updateList()}});
document.addEventListener('submit',e=>{if(e.target.id==='order-form'){e.preventDefault();saveOrder()}if(e.target.id==='ledger-form'){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.amount=Number(f.amount);const i=e.target.dataset.index;if(i==='')ledger.push(f);else ledger[Number(i)]=f;saveState();smallDialog.close();render();toast('Операция сохранена')}});
document.getElementById('reset').onclick=()=>{document.getElementById('small-body').innerHTML='<div class="dialog-head"><h2 id="small-title">Сбросить к демо-примерам?</h2><button class="close" data-close="small" aria-label="Закрыть">×</button></div><div class="dialog-content"><p style="font-size:14px;line-height:1.7">Все ваши изменения в заказах и взаиморасчётах будут сброшены. Вернутся первоначальные примеры.</p></div><div class="dialog-actions"><button class="button" data-close="small">Отмена</button><button class="button primary" id="confirm-reset">Сбросить примеры</button></div>';smallDialog.showModal();document.getElementById('confirm-reset').onclick=()=>{seed();saveState();smallDialog.close();render();toast('Демо-примеры восстановлены')}};
function exportData(){
 const data={appName:'Topordorf CRM',exportDate:new Date().toISOString(),version:1,orders,ledger,sequence};
 const jsonStr=JSON.stringify(data,null,2);
 const blob=new Blob([jsonStr],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;
 a.download=`topordorf_crm_backup_${new Date().toISOString().slice(0,10)}.json`;
 document.body.appendChild(a);a.click();document.body.removeChild(a);
 URL.revokeObjectURL(url);
 toast('Резервная копия скачана (JSON)');
}
function importData(file){
 if(!file)return;
 const reader=new FileReader();
 reader.onload=e=>{
  try{
   const data=JSON.parse(e.target.result);
   if(!data||!Array.isArray(data.orders)||!Array.isArray(data.ledger)){toast('Ошибка: Неверный формат JSON');return;}
   orders=data.orders;ledger=data.ledger;sequence=Number(data.sequence)||108;
   saveState();render();toast(`Импортировано заказов: ${orders.length}`);
  }catch(err){toast('Ошибка при чтении файла JSON');}
 };
 reader.readAsText(file);
}
document.getElementById('export-json')?.addEventListener('click',exportData);
document.getElementById('import-json')?.addEventListener('change',e=>{
 if(e.target.files&&e.target.files[0]){importData(e.target.files[0]);e.target.value='';}
});
setView();

// Reordering only touches the slots of currently visible orders; filtered-out rows stay put.
function phoneHTML(contact){
 const value=String(contact||'').trim();
 if(!value)return '<span class="phone-empty">—</span>';
 const number=value.replace(/[\s().-]/g,'');
 return /^[+]?[0-9]{7,15}$/.test(number)?`<a class="phone-link" href="tel:${esc(number)}">${esc(value)}</a>`:`<span class="phone-value">${esc(value)}</span>`;
}
function reorderVisible(source,target,after=false){
 const visible=filtered();const from=visible.findIndex(o=>o.id===source);
 if(from<0||source===target||!visible.some(o=>o.id===target))return false;
 const [moved]=visible.splice(from,1);const to=visible.findIndex(o=>o.id===target);
 visible.splice(to+(after?1:0),0,moved);
 const ids=new Set(visible.map(o=>o.id));let n=0;
 orders=orders.map(o=>ids.has(o.id)?visible[n++]:o);return true;
}
let rowDrag=null;
function dragTarget(){
 if(!rowDrag)return;
 document.querySelectorAll('.drop-before,.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));
 const rows=[...document.querySelectorAll('.order-table tbody tr')];
 const table=document.querySelector('.order-table');const box=table?.getBoundingClientRect();
 if(!box||rowDrag.x<box.left||rowDrag.x>box.right){rowDrag.target=null;return;}
 let row=rows.find(r=>{const b=r.getBoundingClientRect();return rowDrag.y>=b.top&&rowDrag.y<=b.bottom});
 if(!row&&rows.length){if(rowDrag.y<rows[0].getBoundingClientRect().top)row=rows[0];else if(rowDrag.y>rows.at(-1).getBoundingClientRect().bottom)row=rows.at(-1);}
 if(!row||row.dataset.orderId===rowDrag.id){rowDrag.target=null;return;}
 const b=row.getBoundingClientRect();rowDrag.target=row.dataset.orderId;rowDrag.after=rowDrag.y>b.top+b.height/2;
 row.classList.add(rowDrag.after?'drop-after':'drop-before');
}
function dragScroll(){
 if(!rowDrag)return;
 if(rowDrag.started){const margin=70;const step=rowDrag.y<margin?-12:rowDrag.y>innerHeight-margin?12:0;if(step){window.scrollBy(0,step);dragTarget();}}
 rowDrag.frame=requestAnimationFrame(dragScroll);
}
function finishDrag(commit){
 if(!rowDrag)return;
 const d=rowDrag;rowDrag=null;cancelAnimationFrame(d.frame);
 document.body.classList.remove('reordering');
 document.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(el=>el.classList.remove('dragging','drop-before','drop-after'));
 if(d.handle.hasPointerCapture(d.pointer))d.handle.releasePointerCapture(d.pointer);
 if(commit&&d.started&&d.target&&reorderVisible(d.id,d.target,d.after)){
  saveState();updateList();document.querySelector(`[data-drag="${d.id}"]`)?.focus({preventScroll:true});toast('Порядок заказов изменён');
 }
}
 document.addEventListener('pointerdown',e=>{
 const handle=e.target.closest('[data-drag]');if(!handle||!e.isPrimary||e.button!==0)return;
 e.preventDefault();handle.focus({preventScroll:true});
 rowDrag={id:handle.dataset.drag,handle,pointer:e.pointerId,x:e.clientX,y:e.clientY,startY:e.clientY,started:false,target:null};
 handle.setPointerCapture(e.pointerId);rowDrag.frame=requestAnimationFrame(dragScroll);
 });
 document.addEventListener('pointermove',e=>{
 if(!rowDrag||e.pointerId!==rowDrag.pointer)return;
 rowDrag.x=e.clientX;rowDrag.y=e.clientY;
 if(!rowDrag.started&&Math.abs(e.clientY-rowDrag.startY)>5){rowDrag.started=true;rowDrag.handle.closest('tr').classList.add('dragging');document.body.classList.add('reordering');}
 if(rowDrag.started){e.preventDefault();dragTarget();}
 },{passive:false});
 document.addEventListener('pointerup',e=>{if(rowDrag&&e.pointerId===rowDrag.pointer)finishDrag(true)});
 document.addEventListener('pointercancel',()=>finishDrag(false));
 document.addEventListener('lostpointercapture',()=>finishDrag(false));
 window.addEventListener('blur',()=>finishDrag(false));
 window.addEventListener('hashchange',()=>finishDrag(false));
 document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&rowDrag){finishDrag(false);return;}
 const handle=e.target.closest('[data-drag]');if(!handle||!['ArrowUp','ArrowDown'].includes(e.key))return;
 e.preventDefault();const rows=filtered(),i=rows.findIndex(o=>o.id===handle.dataset.drag),down=e.key==='ArrowDown',target=rows[i+(down?1:-1)];
 if(!target)return;const id=handle.dataset.drag;
 reorderVisible(id,target.id,down);saveState();updateList();document.querySelector(`[data-drag="${id}"]`)?.focus({preventScroll:true});toast('Порядок заказов изменён');
 });

const SKETCH_RULES = `Создай готовый чёрно-белый эскиз для лазерной гравировки двух сторон топора по прикреплённому шаблону.

КОНТУР И РАЗМЕЩЕНИЕ
Используй прикреплённый контур двух топоров как неизменяемый шаблон. Строго сохрани внешнюю геометрию, пропорции, изгибы, размеры и взаимное расположение обеих сторон. Не перерисовывай, не растягивай, не обрезай и не зеркаль контур. Весь рисунок и надписи должны находиться внутри контура. По всему краю оставь небольшой чистый белый отступ. Ни один элемент не должен касаться границы или выходить за неё.
Не привязывай орнамент вплотную к границе и не обводи рисунком форму лезвия: реальный топор может немного отличаться. Сохрани свободное размещение композиции внутри шаблона.

КОМПОЗИЦИЯ
На двух сторонах — связанные по теме, но разные композиции: слева основной сюжет, справа дополняющий. Если в теме указаны сюжеты каждой стороны, точно соблюдай их. Главные фигуры крупные, выразительные и хорошо читаемые. Детали и орнамент гармонично связывают композицию, не перегружают её. Стиль немного живой, рисованный, с замысловатыми, но читаемыми формами.

ГРАФИКА
Только чистые чёрный и белый цвета. Основной фон белый. Стиль: лазерная графика, линогравюра, трафарет, tattoo flash. Предпочтительны заполненные чёрные фигуры с белыми вырезами и просветами внутри, а не пустые контурные изображения.
Используй крупные закрытые формы, широкие уверенные контуры и 2–3 различимые толщины линий. Внутренние линии допустимы, но только необходимые и хорошо читаемые. Все контуры должны быть замкнуты, без случайных разрывов и незавершённых линий.
Соседние чёрные фигуры, фон и предметы разделяй ясными белыми просветами, чтобы они не сливались. Черты лица, шерсть, перья и фактуры передавай крупными чёрными формами и белыми вырезами.

ЗАПРЕТЫ
Без мелкой и перекрёстной штриховки, тонких частых параллельных линий, крапинок, точечного шума, мелкой шерсти, серого цвета, полутонов, градиентов, размытия и фотографических теней. Тени — только крупными чёрными формами, белыми вырезами и редкими выразительными линиями. Не добавляй сплошной чёрный фон вокруг надписей.

НАДПИСИ
Добавляй только надписи, явно указанные в теме или задании. Сохраняй точное написание, буквы, номера и расположение. Сделай надписи чёткими, крупными и гармонично включёнными в композицию. Не добавляй произвольных слов, водяных знаков и подписей.

ПРОВЕРКА ПЕРЕД ВЫДАЧЕЙ
Проверь обе стороны: внешний контур не изменён, рисунок строго внутри, белый отступ сохранён, фон белый, фигуры не сливаются, мелкой штриховки нет, формы замкнуты, надписи точны. Выдай одно изображение с обеими сторонами в исходном расположении, без перспективы, макета топора и постороннего оформления.`;
function composeSketchPrompt(theme,task){
 return `Тема эскиза: ${theme.trim()||'[УКАЖИТЕ ТЕМУ]'}${task.trim()?'\n\nПожелания к рисунку:\n'+task.trim():''}\n\n${SKETCH_RULES}`;
}
function openSketchCreator(orderId=''){
 const o=orders.find(x=>x.id===orderId);
 const dialog=document.getElementById('sketch-dialog');
 dialog.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">ТЕМА ЭСКИЗА · ДВЕ СТОРОНЫ ТОПОРА</div><h2 id="sketch-title">Создать эскиз</h2></div><button class="close" type="button" data-sketch-close aria-label="Закрыть">×</button></div><div class="dialog-content sketch-generator"><div class="sketch-generator-fields"><label class="field">Заказ<select id="sketch-order"><option value="">Без привязки к заказу</option>${orders.map(x=>`<option value="${x.id}" ${x.id===o?.id?'selected':''}>${x.id} · ${esc(x.client)}</option>`).join('')}</select></label><label class="field">Тема эскиза<input id="sketch-theme" value="${esc(o?.theme||'')}" maxlength="500" placeholder="Например: Велес и медвежья лапа"></label><label class="field">Пожелания к рисунку<textarea id="sketch-task" maxlength="10000" placeholder="Сюжет каждой стороны, точные надписи, символы…">${esc(o?.task||'')}</textarea></label><p class="field-hint">Из заказа подставлены тема и ТЗ. Перед копированием оставьте здесь только пожелания к рисунку.</p></div><div class="contour-card"><div class="contour-heading">Контур топоров <span>Исходный шаблон</span></div><img src="axe-contour.jpg" alt="Исходный неизменённый контур двух сторон топора" width="710" height="449"><a class="button" href="axe-contour.jpg" download="axe-contour.jpg">${icon('image')} Скачать контур</a><p class="field-hint">Прикрепите этот файл к сообщению вместе с промтом.</p></div><label class="field full prompt-field">Готовый промт<textarea id="sketch-prompt" spellcheck="false">${esc(composeSketchPrompt(o?.theme||'',o?.task||''))}</textarea></label></div><div class="dialog-actions sketch-generator-actions"><p class="field-hint">Скопируйте промт и прикрепите скачанный контур в чат. Генерация в этом окне не запускается.</p><div class="right"><button class="button" type="button" data-sketch-close>Закрыть</button><button class="button primary" type="button" id="copy-sketch-prompt">${icon('copy')} Скопировать промт</button></div></div>`;
 dialog.showModal();
 dialog.querySelectorAll('[data-sketch-close]').forEach(b=>b.onclick=()=>dialog.close());
 const theme=dialog.querySelector('#sketch-theme'),task=dialog.querySelector('#sketch-task'),prompt=dialog.querySelector('#sketch-prompt');
 const regenerate=()=>{prompt.value=composeSketchPrompt(theme.value,task.value)};
 theme.addEventListener('input',regenerate);task.addEventListener('input',regenerate);
 dialog.querySelector('#sketch-order').onchange=e=>{const selected=orders.find(x=>x.id===e.target.value);theme.value=selected?.theme||'';task.value=selected?.task||'';regenerate()};
 dialog.querySelector('#copy-sketch-prompt').onclick=async()=>{
  try{await navigator.clipboard.writeText(prompt.value);toast('Промт скопирован. Прикрепите к нему контур в чате.')}catch{prompt.focus();prompt.select();toast('Выделил промт — скопируйте его вручную.')}
 };
}
document.addEventListener('click',e=>{
 const button=e.target.closest('button');if(!button)return;
 if(button.dataset.action==='create-sketch')openSketchCreator();
 if(button.dataset.sketchOrder)openSketchCreator(button.dataset.sketchOrder);
});

function imageSource(value){
 const href=safeURL(String(value||'').trim());if(!href)return {kind:value?'invalid':'empty'};
 const url=new URL(href);
 if(['drive.google.com','docs.google.com','www.drive.google.com'].includes(url.hostname)){
  if(url.pathname.includes('/folders/'))return {kind:'folder',href};
  const match=url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  const id=match?.[1]||(['/open','/uc','/thumbnail'].includes(url.pathname)?url.searchParams.get('id'):null);
  if(!id||!/^[A-Za-z0-9_-]+$/.test(id))return {kind:'unsupported',href};
  const preview=new URL('https://drive.google.com/file/d/'+id+'/preview');
  const key=url.searchParams.get('resourcekey');if(key)preview.searchParams.set('resourcekey',key);
  return {kind:'drive',href,preview:preview.href};
 }
 return {kind:'direct',href};
}
function imagePreview(value,compact=false){
 const source=imageSource(value);
 if(source.kind==='empty')return compact?`<div class="sketch-art">${icon('image')}<span>Рисунок ещё не добавлен</span></div>`:'';
 if(source.kind==='invalid')return '<p class="field-hint preview-message">Вставьте полную ссылку, начинающуюся с https://</p>';
 if(source.kind==='folder'||source.kind==='unsupported')return `<div class="preview-message"><p class="field-hint">${source.kind==='folder'?'Это ссылка на папку. Откройте в ней изображение и скопируйте ссылку на сам файл.':'Не удалось распознать файл. Скопируйте ссылку через «Поделиться» в Google Drive.'}</p><a href="${esc(source.href)}" target="_blank" rel="noopener noreferrer" class="text-button">Открыть в Google Drive</a></div>`;
 return `<div class="image-view ${compact?'compact':''}">${source.kind==='drive'?`<iframe class="drive-preview" src="${esc(source.preview)}" title="Просмотр эскиза в Google Drive" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe>`:`<img class="direct-preview" data-sketch-image src="${esc(source.href)}" alt="Эскиз заказа" loading="lazy" referrerpolicy="no-referrer"><p class="field-hint image-load-error" hidden>Изображение не загрузилось. Проверьте ссылку и доступ к файлу.</p>`}<div class="image-view-footer"><a href="${esc(source.href)}" target="_blank" rel="noopener noreferrer">Открыть оригинал ↗</a>${source.kind==='drive'?'<p class="field-hint">Если Google просит доступ или вход, откройте оригинал. Для просмотра без входа нужен доступ «Все, у кого есть ссылка».</p>':''}</div></div>`;
}
let imagePreviewTimer;
document.addEventListener('input',e=>{
 if(!e.target.matches('#order-form [name="image"]'))return;
 clearTimeout(imagePreviewTimer);const input=e.target;
 imagePreviewTimer=setTimeout(()=>{if(input.isConnected){const box=document.getElementById('order-image-preview');if(box)box.innerHTML=imagePreview(input.value)}},450);
});
document.addEventListener('change',e=>{
 if(e.target.matches('#order-form [name="image"]')){
  clearTimeout(imagePreviewTimer);document.getElementById('order-image-preview').innerHTML=imagePreview(e.target.value);
 }
});
document.addEventListener('error',e=>{
 if(e.target.matches?.('[data-sketch-image]')){e.target.hidden=true;const message=e.target.parentElement.querySelector('.image-load-error');if(message)message.hidden=false;}
},true);

function inlineStatus(o){
 return `<select class="inline-status badge ${classes[statuses.indexOf(o.status)]||'new'}" data-order-status="${esc(o.id)}" aria-label="Статус заказа ${esc(o.id)} — ${esc(o.client)}" title="Изменить статус заказа">${statuses.map(status=>statusOption(status,o.status)).join('')}</select>`;
}
function setOrderStatus(id,status){
 const order=orders.find(o=>o.id===id);
 if(!order||!statuses.includes(status)||order.status===status)return null;
 const previous=order.status;order.status=status;
 order.history=[...(order.history||[]),`${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · Статус: ${previous} → ${status}`];
 return order;
}
document.addEventListener('change',e=>{
 const control=e.target.closest('[data-order-status]');if(!control)return;
 const order=setOrderStatus(control.dataset.orderStatus,control.value);if(!order)return;
 const scroll=window.scrollY;render();window.scrollTo(0,scroll);
 const remaining=document.querySelector(`[data-order-status="${order.id}"]`);
 if(remaining)remaining.focus({preventScroll:true});
 else document.getElementById('status-filter')?.focus({preventScroll:true});
 toast(!active(order)?`${order.id} перенесён в архив · ${order.status}`:`${order.id}: ${order.status}`);
});

function statusStyle(status){const i=statuses.indexOf(status);return i<0?'':`background-color:${statusColors[i]};color:${statusTextColors[i]}`;}
function statusOption(status,selected){return `<option value="${esc(status)}" style="${statusStyle(status)}" ${status===selected?'selected':''}>${esc(status)}</option>`;}
document.addEventListener('change',e=>{if(e.target.matches('#order-form [name="status"]'))e.target.setAttribute('style',statusStyle(e.target.value));});

function employeeTaskText(o,id){
 return [`ЗАКАЗ ${id||'(новый)'}`,o.theme?`Тема: ${o.theme}`:null,o.contact?.trim()?`Телефон: ${o.contact.trim()}`:null,`Срок: ${o.due?new Date(o.due+'T12:00:00').toLocaleDateString('ru-RU'):'уточнить'}`,`Приоритет: ${o.priority}`,'',o.task||'Техническое задание пока не заполнено','',`Эскиз: ${o.sketch}`,o.folder?.trim()?`Папка заказа: ${o.folder.trim()}`:null,o.image?.trim()?`Ссылка на эскиз: ${o.image.trim()}`:null].filter(x=>x!==null).join('\n');
}

EOF_FILE_app_js

cat << 'EOF_FILE_styles_css' > "$TARGET_DIR/styles.css"
@import url('https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&display=swap');
:root{font-family:'Golos Text',system-ui,sans-serif;color:#24312c;background:#f4f6f5;font-synthesis:none;--ink:#182b23;--green:#29583e;--muted:#78817d;--line:#e3e8e4;--gold:#d7ae69;--white:#fff}*{box-sizing:border-box}body{margin:0;font-size:16px}button,input,textarea,select{font:inherit}button,a,input,select,textarea{-webkit-tap-highlight-color:transparent}button,a{touch-action:manipulation}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}a{color:inherit}button:focus-visible,a:focus-visible{outline:3px solid #c49952;outline-offset:3px}button{border:0}button svg,a svg{width:19px;height:19px;flex-shrink:0}svg{stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}h1,h2,h3,p{margin:0}h1{font-size:32px;letter-spacing:-1.2px;font-weight:600}h2{font-size:20px;font-weight:600}h3{font-size:16px;font-weight:600}small{font-size:12px}.sidebar{width:242px;background:#182320;color:#dce3dd;position:fixed;inset:0 auto 0 0;display:flex;flex-direction:column;padding:34px 20px 20px}.brand{display:flex;gap:11px;align-items:center;text-decoration:none;font-size:16px;font-weight:800;letter-spacing:.7px;margin:0 0 51px}.brand-symbol{width:40px;height:43px;border:1px solid #d1ab70;color:#e0ba7c;display:grid;place-items:center;font-family:Georgia,serif;letter-spacing:-3px;font-size:22px;flex-shrink:0}.brand small{display:block;font-size:9px;letter-spacing:1.5px;color:#97a79e;margin-top:6px}.nav-label{font-size:10px;letter-spacing:1.5px;color:#86988c;margin:0 10px 17px}nav{display:grid;gap:7px}nav a{display:flex;align-items:center;gap:13px;text-decoration:none;padding:13px 14px;border-radius:6px;font-size:14px;color:#bac9c0}nav a:hover{background:#25332b}nav a.active{background:#324737;color:#fff}nav a.active svg{color:#dcb579}nav a .count{margin-left:auto;font-size:12px;background:#465b48;padding:2px 7px;border-radius:4px}.side-note{margin-top:auto;padding:40px 12px;color:#a1b0a6}.small-line{display:block;width:27px;border-top:2px solid #b49462;margin-bottom:20px}.side-note strong{font-family:Georgia,serif;font-size:21px;line-height:1.45;font-weight:400;color:#dce3da}.side-note p{font-size:12px;line-height:1.8;margin-top:12px}.owner{border-top:1px solid #344139;padding:21px 8px 0;display:flex;align-items:center;gap:12px;font-size:13px}.avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#3c4a3d;color:#e0bc7c}.owner small{display:block;color:#8fa395;margin-top:4px}.workspace{margin-left:242px;min-height:100vh;display:flex;flex-direction:column}.topbar{height:76px;border-bottom:1px solid var(--line);background:#fff;padding:0 38px;display:flex;align-items:center;justify-content:space-between;font-size:13px;color:#67766d}.topbar #breadcrumb span{padding:0 13px;color:#bac4be}.top-right{display:flex;gap:22px;align-items:center}.private-label{border-left:1px solid var(--line);padding-left:20px;color:#344c3e}main{padding:24px 38px 40px;flex:1;max-width:1800px;width:100%;margin:auto}.demo-banner{display:flex;justify-content:space-between;gap:14px;align-items:center;background:#edf1eb;border:1px solid #dce4d8;border-radius:6px;padding:10px 14px;font-size:12px;color:#60705e;margin-bottom:27px}.banner-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.demo-banner b{font-weight:500;color:#344c36}.text-button{background:none;color:var(--green);white-space:nowrap;padding:4px;font-size:12px;text-decoration:underline;text-underline-offset:3px}.page-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:26px}.eyebrow{font-size:10px;letter-spacing:1.7px;color:#7e897f;margin-bottom:8px}.subtitle{font-size:14px;color:var(--muted);margin-top:9px}.button{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:1px solid #dce3dc;background:white;padding:11px 16px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;min-height:43px;white-space:nowrap}.button.primary{background:var(--green);border-color:var(--green);color:white}.button.primary:hover{background:#1b442e}.button:hover{border-color:#96a494}.button.light{background:#f4f6f3}.button.danger{color:#9c4e3d}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:26px}.stat{background:#fff;border:1px solid var(--line);border-radius:8px;padding:20px;position:relative}.stat.selected{background:#254732;color:#fff;border-color:#254732}.stat-label{color:#728073;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:8px}.stat-label svg{width:18px;height:18px;color:#98a394}.selected .stat-label,.selected .stat-label svg{color:#c6d4c2}.stat-value{font-size:29px;font-weight:500;letter-spacing:-.7px;margin-top:15px;white-space:nowrap}.stat-note{color:#8b948c;font-size:12px;margin-top:8px}.selected .stat-note{color:#b4c5b1}.stat-note.warn{color:#b07136}.panel{background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:19px 22px;border-bottom:1px solid var(--line)}.tabs{display:flex;gap:7px;flex-wrap:wrap}.tab{background:transparent;padding:9px 12px;border-radius:5px;color:#7b857d;font-size:14px}.tab.active{background:#edf2ed;color:#2d5037;font-weight:500}.tab .tab-count{font-size:11px;margin-left:7px;color:#7b8b7c}.filters{display:flex;gap:10px}.search{position:relative}.search svg{width:18px;height:18px;position:absolute;left:11px;top:12px;color:#89948b}.search input{padding-left:36px!important;width:220px}.filters input,.filters select{font-size:13px;min-height:41px}input,select,textarea{border:1px solid #dce2dc;border-radius:5px;background:#fff;padding:10px 11px;color:#26372a;max-width:100%;outline:none}input:focus,select:focus,textarea:focus{border-color:#68926c;box-shadow:0 0 0 3px #29583e14}textarea{resize:vertical;line-height:1.6;min-height:112px}table{border-collapse:collapse;width:100%;text-align:left}th{background:#fafbf9;color:#829084;font-size:10px;letter-spacing:.9px;font-weight:500;padding:14px 18px;border-bottom:1px solid var(--line)}td{padding:20px 18px;border-bottom:1px solid #edf0ec;font-size:14px}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#fafcf9}.order-cell{display:flex;align-items:center;gap:13px}.monogram{height:39px;width:39px;background:#eef1eb;color:#5c7357;display:grid;place-items:center;border-radius:7px;font-size:14px;flex-shrink:0}.order-name{background:none;padding:0;color:#283d2c;font-size:14px;text-align:left;font-weight:500}.order-name:hover{text-decoration:underline}.meta{font-size:12px;color:#8b938d;margin-top:6px}.order-id{font-size:11px;letter-spacing:.3px;color:#89978a}.theme{font-size:13px;max-width:190px;line-height:1.5}.badge{display:inline-flex;align-items:center;border-radius:4px;padding:6px 9px;font-size:11px;line-height:1.25;white-space:nowrap}.badge.production{color:#446547;background:#eaf1e7}.badge.sketch{color:#a07232;background:#faf0de}.badge.review{color:#6b6699;background:#efedf8}.badge.ready{color:#317365;background:#e5f3ec}.badge.new{color:#607585;background:#eaf0f5}.badge.sent{color:#627568;background:#eaf0ec}.badge.payment{color:#ac713b;background:#fbefdf}.badge.closed{color:#7d8580;background:#f0f2ef}.due{font-size:13px;white-space:nowrap}.due.late{color:#bc6954}.priority{display:inline-block;color:#bb7b44;margin-left:7px;font-size:11px}.money{font-size:13px;white-space:nowrap}.money .meta{font-size:11px}.paid{color:#7b977b}.row-open{background:none;padding:8px;color:#8f9a90;font-size:21px}.table-foot{padding:15px 22px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:12px;color:#8c978d}.bottom-note{display:flex;align-items:center;gap:9px;font-size:12px;color:#8b938b;margin:19px 2px}.bottom-note svg{height:16px;width:16px}.empty{padding:54px 20px;text-align:center;color:#819080}.empty h3{color:#435b44;margin-bottom:8px}.empty p{font-size:14px;margin-bottom:18px}.dashboard-columns{display:grid;grid-template-columns:1.3fr 1fr;gap:20px}.panel-title{padding:21px 23px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}.panel-title h2{font-size:17px}.agenda-item{display:flex;align-items:center;gap:15px;padding:18px 22px;border-bottom:1px solid var(--line)}.agenda-item:last-child{border-bottom:0}.agenda-item>div:nth-child(2){flex:1}.stage-row{padding:13px 22px;display:grid;grid-template-columns:1fr 100px 20px;align-items:center;gap:14px;font-size:13px}.stage-track{height:5px;border-radius:10px;background:#edf1eb;overflow:hidden}.stage-track span{display:block;background:#83a17c;height:100%}.sketch-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.sketch-card{border:1px solid var(--line);border-radius:8px;background:#fff;overflow:hidden}.sketch-art{height:150px;background:repeating-linear-gradient(0deg,transparent,transparent 23px,#d9dfd74d 24px),repeating-linear-gradient(90deg,#f1f4ee,#f1f4ee 23px,#d9dfd74d 24px);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:#8a9b83}.sketch-art svg{width:31px;height:31px}.sketch-art span{font-size:12px}.sketch-content{padding:20px}.sketch-content h3{margin:12px 0 6px}.sketch-content .button{margin-top:20px;width:100%}.ledger-head{display:flex;gap:12px}.balance-note{font-size:13px;color:#818c7f;margin:16px 0}.ledger-type{font-size:13px}.positive{color:#467649}.negative{color:#af6a47}footer{margin:0 38px;padding:23px 0;border-top:1px solid var(--line);display:flex;gap:20px;color:#a0aaa0;font-size:10px;letter-spacing:1px}footer span{letter-spacing:0}footer span:last-child{margin-left:auto}.order-dialog{width:min(830px,100vw - 32px);max-height:92vh;border:0;border-radius:12px;padding:0;color:var(--ink);box-shadow:0 24px 90px #152d2840}.small-dialog{width:min(490px,100vw - 32px);border:0;border-radius:12px;padding:0;color:var(--ink);max-height:90vh}.order-dialog::backdrop,.small-dialog::backdrop{background:#0e211b80;backdrop-filter:blur(3px)}.dialog-head{display:flex;justify-content:space-between;align-items:flex-start;padding:25px 28px;border-bottom:1px solid var(--line);gap:20px}.dialog-head h2{font-size:23px;margin-top:5px}.dialog-head .eyebrow{margin:0}.close{background:#f0f3ef;border-radius:50%;width:32px;height:32px;font-size:22px;color:#6c786b;flex-shrink:0}.dialog-content{padding:25px 28px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:19px}.field{display:flex;flex-direction:column;gap:7px;font-size:13px;color:#60715f}.field.full{grid-column:1/-1}.field input,.field select,.field textarea{width:100%;font-size:14px}.section-title{font-size:13px;font-weight:600;color:#52694f;margin:25px 0 16px;display:flex;align-items:center;gap:12px}.section-title:after{content:'';flex:1;height:1px;background:var(--line)}.form-grid.four{grid-template-columns:repeat(4,1fr)}.total-strip{display:flex;justify-content:space-between;gap:10px;background:#f1f5ee;padding:17px;border-radius:6px;margin-top:16px;font-size:13px}.total-strip strong{display:block;font-size:18px;font-weight:500;margin-top:5px}.dialog-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 28px;border-top:1px solid var(--line);background:#fafbf8;position:sticky;bottom:0}.dialog-actions .right{display:flex;gap:9px}.field-hint{font-size:12px;color:#8a9587;line-height:1.6}.copy-section{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}.history{padding:13px 0;font-size:12px;color:#82907e;line-height:1.8}.preview-box{width:100%;max-height:220px;object-fit:contain;background:#f6f7f4;border-radius:6px;margin-top:12px}.copy-text{width:100%;min-height:230px;font-size:14px}#toast{position:fixed;bottom:24px;left:50%;transform:translate(-50%,20px);padding:14px 22px;border-radius:7px;background:#263e2e;color:#fff;box-shadow:0 8px 30px #14291630;font-size:14px;opacity:0;pointer-events:none;z-index:20;transition:.2s;max-width:90vw}#toast.show{opacity:1;transform:translate(-50%,0)}.mobile-label{display:none}.header-actions{display:flex;gap:10px}
.drag-handle{display:grid;place-items:center;padding:0;min-width:28px;height:40px;background:transparent;color:#849381;border-radius:5px;cursor:grab;touch-action:none;flex-shrink:0}.drag-handle:hover,.drag-handle:focus-visible{background:#e6ede2;color:#2b583d}.drag-handle svg{width:18px;height:22px;stroke-width:3}.reordering,.reordering .drag-handle{cursor:grabbing;user-select:none}.order-table tr.dragging{background:#ecf3e8;opacity:.6}.order-table tr.drop-before td{box-shadow:inset 0 3px #48734d}.order-table tr.drop-after td{box-shadow:inset 0 -3px #48734d}.phone-link,.phone-value{font-size:13px;line-height:1.6;overflow-wrap:anywhere}.phone-link{text-decoration:none}.phone-link:hover{text-decoration:underline}.phone-empty{color:#9aa598}.phone-col{min-width:135px;max-width:190px}.order-cell{gap:9px}
@media(min-width:1500px){td{padding:24px}.stat{padding:25px}.stat-value{font-size:34px}}
@media(max-width:1200px){.sidebar{width:210px;padding:28px 15px 20px}.workspace{margin-left:210px}main{padding:22px}.topbar{padding:0 22px}.toolbar{align-items:flex-start;flex-direction:column}.filters{width:100%}.search{flex:1}.search input{width:100%}td,th{padding:17px 12px}.theme-col{display:none}.stat{padding:16px}.stat-value{font-size:25px}footer{margin:0 22px}.sketch-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:800px){.sidebar{position:static;width:100%;padding:18px 18px 0;display:block}.brand{margin:0 0 20px;font-size:15px}.brand-symbol{height:32px;width:32px;font-size:18px}.brand small{font-size:8px}.nav-label,.side-note,.owner{display:none}nav{display:flex;overflow-x:auto;gap:5px;padding-bottom:12px}nav a{white-space:nowrap;font-size:13px;padding:10px}nav a svg{width:16px;height:16px}nav a .count{display:none}.workspace{margin:0}.topbar{height:50px;padding:0 18px;font-size:12px}.private-label{display:none}main{padding:16px}.demo-banner{font-size:11px;align-items:flex-start;margin-bottom:22px;line-height:1.6}.demo-banner .text-button{font-size:11px}.page-head{margin-bottom:20px}h1{font-size:27px}.subtitle{font-size:12px;line-height:1.6}.eyebrow{font-size:9px}.button{padding:10px 12px;font-size:13px}.stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:18px}.stat{padding:16px}.stat-label{font-size:12px}.stat-value{margin-top:10px;font-size:27px}.stat-note{font-size:11px}.toolbar{padding:12px;gap:12px}.tabs{gap:0}.tab{padding:9px;font-size:12px}.tab .tab-count{margin-left:4px}.filters select{max-width:140px}.filters input{min-width:0}.dashboard-columns{grid-template-columns:1fr}.order-table thead{display:none}.order-table,.order-table tbody{display:block}.order-table tr{display:grid;grid-template-columns:1fr auto;gap:13px;padding:17px;border-bottom:1px solid var(--line);position:relative}.order-table td{border:0;padding:0}.order-table .order-main{grid-column:1;grid-row:1}.order-table .status-col{grid-column:2;grid-row:1;align-self:center}.order-table .due-col{grid-column:1;grid-row:2;padding-left:52px}.order-table .money-col{grid-column:2;grid-row:2;text-align:right}.order-table .open-col{display:none}.monogram{width:39px}.order-name{font-size:14px}.mobile-label{display:inline;color:#84917f;font-size:11px;margin-right:5px}.table-foot{padding:13px;font-size:11px}.bottom-note{font-size:11px;line-height:1.5}.sketch-grid{gap:12px}.sketch-content{padding:14px}.sketch-art{height:120px}footer{margin:0 16px;font-size:9px}footer>span:nth-child(1){display:none}.form-grid.four{grid-template-columns:repeat(2,1fr)}.dialog-head,.dialog-content{padding:20px}.dialog-actions{padding:15px 20px;flex-wrap:wrap}.dialog-actions .right{margin-left:auto}.order-dialog{width:calc(100vw - 16px);max-height:96vh}.ledger-head{flex-wrap:wrap}.ledger-table td,.ledger-table th{padding:13px 10px;font-size:12px}.ledger-table .ledger-note{display:none}}
@media(max-width:600px){.stats[style]{grid-template-columns:1fr!important}.stats[style] .stat{display:flex;justify-content:space-between;align-items:center;gap:12px}.stats[style] .stat-value{margin-top:0;font-size:24px}}
@media(max-width:420px){.page-head{align-items:flex-start}.page-head .button{font-size:12px;padding:10px}.stat-value{font-size:24px}.sketch-grid{grid-template-columns:1fr}.form-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.total-strip strong{font-size:15px}.top-right{font-size:11px}.table-foot span:last-child{display:none}}
@media(max-width:800px){.order-table .phone-col{grid-column:1/-1;grid-row:2;padding-left:37px;max-width:none;min-width:0}.order-table .due-col{grid-row:3;padding-left:37px}.order-table .money-col{grid-row:3}.order-table .monogram{display:none}.drag-handle{min-width:28px;height:44px}.order-table tr.drop-before{box-shadow:inset 0 3px #48734d}.order-table tr.drop-after{box-shadow:inset 0 -3px #48734d}.order-table tr.drop-before td,.order-table tr.drop-after td{box-shadow:none}.order-table tr{column-gap:8px}}
.sketch-content .sketch-create{margin-top:9px}.sketch-dialog{width:min(960px,100vw - 32px)}.sketch-generator{display:grid;grid-template-columns:1fr 1fr;gap:24px}.sketch-generator-fields{display:grid;gap:16px}.sketch-generator .prompt-field{grid-column:1/-1}.prompt-field textarea{min-height:300px;font-size:14px;line-height:1.7}.contour-card{align-self:start;border:1px solid var(--line);border-radius:8px;padding:16px;background:#f8faf6}.contour-heading{font-size:14px;font-weight:500;margin-bottom:12px}.contour-heading span{display:block;font-size:12px;font-weight:400;color:var(--muted);margin-top:5px}.contour-card img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:4px;background:white;margin-bottom:14px}.contour-card .button{width:100%;margin-bottom:10px}.sketch-generator-actions{align-items:center;flex-wrap:wrap}.sketch-generator-actions>p{max-width:400px}.sketch-generator input,.sketch-generator textarea,.sketch-generator select{font-size:14px;width:100%}@media(max-width:650px){.sketch-generator{grid-template-columns:1fr;gap:20px}.sketch-dialog{width:calc(100vw - 16px)}.sketch-generator-actions .right{width:100%;justify-content:flex-end}.prompt-field textarea{min-height:260px}}
.image-view{border:1px solid var(--line);border-radius:7px;overflow:hidden;margin-top:13px;background:#f6f8f3}.drive-preview{display:block;border:0;width:100%;height:360px;background:#f4f6f2}.direct-preview{display:block;width:100%;height:320px;object-fit:contain;background:white}.direct-preview[hidden]{display:none}.image-view-footer{padding:10px 13px;background:white}.image-view-footer>a{font-size:13px;color:var(--green);text-underline-offset:3px}.image-view-footer p{margin-top:7px}.image-view.compact{margin:0;border:0;border-radius:0}.compact .drive-preview,.compact .direct-preview{height:220px}.compact .image-view-footer p{font-size:11px}.preview-message{padding:14px;border:1px solid var(--line);border-radius:6px;margin-top:12px}.preview-message a{display:inline-block;margin-top:8px}.image-load-error{padding:30px 18px}.image-load-error[hidden]{display:none}@media(max-width:600px){.drive-preview{height:280px}.direct-preview{height:240px}}
.inline-status{display:block;width:100%;min-width:150px;max-width:205px;min-height:40px;padding:8px 26px 8px 10px;font-size:14px;font-weight:400;line-height:1.4;border:1px solid transparent;cursor:pointer;appearance:auto}.inline-status:hover{border-color:#829a7e}.inline-status:focus{border-color:#598257;box-shadow:0 0 0 3px #29583e20}.inline-status option{color:#24312c;background:#fff}@media(max-width:800px){.inline-status{min-width:0;max-width:168px;min-height:44px;padding:8px 5px 8px 8px;font-size:13px}.order-table .status-col{max-width:168px}}

.open-order-label{display:none}@media(max-width:800px){.order-table .open-col{display:block;grid-column:1/-1;grid-row:4;padding-top:3px}.order-table .row-open{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:44px;padding:10px 14px;border:1px solid #cbd8c8;border-radius:6px;background:#eef4eb;color:#29583e;font-size:22px}.order-table .row-open:hover{background:#e0ecdb}.open-order-label{display:inline;font-size:14px;font-weight:500}}

/* Order status colors sampled from the supplied reference. */
.badge.order-status-0{background-color:#e8eaed;color:#182320}
.badge.order-status-1{background-color:#e6cff2;color:#182320}
.badge.order-status-2{background-color:#62f870;color:#182320}
.badge.order-status-3{background-color:#ffe700;color:#182320}
.badge.order-status-4{background-color:#e6cff2;color:#182320}
.badge.order-status-5{background-color:#20e633;color:#182320}
.badge.order-status-6{background-color:#045ce0;color:#ffffff}
.badge.order-status-7{background-color:#215a6c;color:#ffffff}
.badge.order-status-8{background-color:#e8eaed;color:#182320}
.badge.order-status-9{background-color:#b10202;color:#ffffff}
.badge.order-status-10{background-color:#0df8f8;color:#182320}
.badge.order-status-11{background-color:#ffe5a0;color:#182320}
.badge.order-status-12{background-color:#ffe5a0;color:#182320}
/* All mobile sections remain visible, without sideways scrolling. */
@media(max-width:800px){
 .sidebar{position:sticky;top:0;z-index:10;padding:10px 14px 8px;box-shadow:0 3px 12px #18232018}
 .sidebar .brand{margin-bottom:9px;font-size:14px;gap:9px}
 .sidebar .brand-symbol{height:29px;width:29px;font-size:17px}
 .sidebar .brand small{margin-top:3px}
 .sidebar nav{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;overflow:visible;padding:0}
 .sidebar nav a{grid-column:span 2;min-width:0;min-height:44px;justify-content:center;gap:7px;padding:8px 5px;font-size:13px;white-space:normal;text-align:center;line-height:1.35;overflow-wrap:anywhere}
 .sidebar nav a:nth-child(4),.sidebar nav a:nth-child(5){grid-column:span 3}
 .sidebar nav a svg{width:16px;height:16px;flex-shrink:0}
 .sidebar nav a .count{display:none}
 html{scroll-padding-top:155px}
}

EOF_FILE_styles_css

cat << 'EOF_FILE_package_json' > "$TARGET_DIR/package.json"
{
  "name": "topordorf-crm",
  "version": "1.0.0",
  "description": "Сервер CRM мастерской ТопорДорф с автоматической синхронизацией между устройствами",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "keywords": [
    "crm",
    "topordorf",
    "workshop"
  ],
  "author": "ТопорДорф",
  "license": "ISC"
}

EOF_FILE_package_json

cat << 'EOF_FILE_README_md' > "$TARGET_DIR/README.md"
# ТопорДорф — CRM мастерской по изготовлению топоров

Полноценная CRM-система мастерской с сервером синхронизации (Node.js) и гибридным фоновым хранилищем. 
Пять разделов: обзор, заказы, эскизы, взаиморасчёты, архив.

## Ключевые возможности:
- **Автоматическая синхронизация (ПК ↔ Телефон):** Запустите `node server.js` и открывайте CRM с компьютера и мобильного телефона (по Wi-Fi). Любые изменения мгновенно отображаются на всех устройствах.
- **Надёжное хранение:** Данные сохраняются в файле сервера `data/crm_store.json` и дублируются в `localStorage` браузера на случай работы без интернета/сети.
- **Резервные копии JSON:** Скачивание и загрузка полного снимка базы в 1 клик через интерфейс.
- **Генератор промтов для ИИ-эскизов:** Формирует точный промт под лазерную гравировку 2-х сторон топора с использованием шаблона `axe-contour.jpg`.
- **Копирование ТЗ сотруднику:** Формирует чистый текст задания без финансовой информации и личных заметок.

## Запуск:
```bash
node server.js
```
или `npm start`. Сервер будет доступен по адресам `http://localhost:8080` (на ПК) и `http://<IP_ВЫШЕГО_ПК>:8080` (с телефона по Wi-Fi).


EOF_FILE_README_md

cat << 'EOF_FILE_START_HERE_txt' > "$TARGET_DIR/START-HERE.txt"
ТОПОРДОРФ — CRM мастерской (Сервер + Автономный режим)

ЗАПУСК С СИНХРОНИЗАЦИЕЙ (ПК ↔ ТЕЛЕФОН)
Для работы единой базы заказов на ПК и телефоне запустите Node.js сервер:
  node server.js
  или
  npm start

После запуска в консоли отобразится:
  - Ссылка для компьютера: http://localhost:8080
  - Ссылка для телефона (Wi-Fi): http://<ВАШ_IP>:8080 (например, http://192.168.1.45:8080)

Все заказы, изменения статусов и оплаты будут автоматически синхронизироваться между ПК и телефоном в реальном времени.

АВТОНОМНЫЙ РЕЖИМ (БЕЗ СЕРВЕРА)
Можно открыть index.html напрямую в браузере. Данные сохраняются в локальном хранилище браузера (localStorage) и не теряются при F5. Перенос между ПК и телефоном возможен через кнопки «Скачать JSON» / «Загрузить JSON».

ФАЙЛЫ
server.js — сервер синхронизации и баз данных (data/crm_store.json);
index.html — страница; styles.css — оформление; app.js — клиентская логика;
axe-contour.jpg — шаблон контура; README.md — документация проекта.

КОПИРОВАНИЕ ТЗ
Копируются номер заказа, тема, телефон, срок, приоритет, ТЗ, состояние
эскиза и обе ссылки (папка заказа и эскиз), если они заполнены.
Цены, оплаты, адрес и личные заметки автоматически не добавляются.


EOF_FILE_START_HERE_txt

base64 -d << 'EOF_IMG' > "$TARGET_DIR/axe-contour.jpg"
/9j/4AAQSkZJRgABAQEAYABgAAD/4QL0RXhpZgAATU0AKgAAAAgABAE7AAIAAAAOAAABSodpAAQAAAABAAABWJydAAEAAAAcAAAC0OocAAcAAAEMAAAAPgAAAAAc6gAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAT2xlZyBEb3JvZmVldgAABZADAAIAAAAUAAACppAEAAIAAAAUAAACupKRAAIAAAADMjEAAJKSAAIAAAADMjEAAOocAAcAAAEMAAABmgAAAAAc6gAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAyNjowODoyMCAyMzo0MzoyNQAyMDI2OjA4OjIwIDIzOjQzOjI1AAAATwBsAGUAZwAgAEQAbwByAG8AZgBlAGUAdgAAAP/hBCBodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvADw/eHBhY2tldCBiZWdpbj0n77u/JyBpZD0nVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkJz8+DQo8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIj48cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPjxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSJ1dWlkOmZhZjViZGQ1LWJhM2QtMTFkYS1hZDMxLWQzM2Q3NTE4MmYxYiIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIi8+PHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9InV1aWQ6ZmFmNWJkZDUtYmEzZC0xMWRhLWFkMzEtZDMzZDc1MTgyZjFiIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iPjx4bXA6Q3JlYXRlRGF0ZT4yMDI2LTA4LTIwVDIzOjQzOjI1LjIwNzwveG1wOkNyZWF0ZURhdGU+PC9yZGY6RGVzY3JpcHRpb24+PHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9InV1aWQ6ZmFmNWJkZDUtYmEzZC0xMWRhLWFkMzEtZDMzZDc1MTgyZjFiIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iPjxkYzpjcmVhdG9yPjxyZGY6U2VxIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+PHJkZjpsaT5PbGVnIERvcm9mZWV2PC9yZGY6bGk+PC9yZGY6U2VxPg0KCQkJPC9kYzpjcmVhdG9yPjwvcmRmOkRlc2NyaXB0aW9uPjwvcmRmOlJERj48L3g6eG1wbWV0YT4NCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSd3Jz8+/9sAQwAHBQUGBQQHBgUGCAcHCAoRCwoJCQoVDxAMERgVGhkYFRgXGx4nIRsdJR0XGCIuIiUoKSssKxogLzMvKjInKisq/9sAQwEHCAgKCQoUCwsUKhwYHCoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioq/8AAEQgBwQLGAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A+iaKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAork/G/ivUfDsukWmiadFf3uqXDQxpLLsUYXPX8fWsz+3fiZ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QyDKSKUYexGKfRQBwXwVklPwn0yG5YNPbvPFIR0z5zkfoRXe15/8JC0Vh4msXG37F4iu4EUj+AbcH8etegUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFcF8PmOr+K/GXiNwds+orYW+cEeXAgG5T6MWz9a7DWdSTR9Bv9Tlx5dlbSXDZ9EUsf5VzXwl086d8K9DRmMj3EH2p5G6uZWMmT+DCgDsqKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA4H4mf6Hq3gvVVwHh16G1Jx0Sbhv/AEEfhXfVwHxnYW/w+N+zBTYXsFwrHPBD4HT/AHq7+gAooooAKKKKACiiigAooooAKKKKACiiigArgvh6Bc+LfHGogHMmrfZi3r5K7f613tcD8JF3aZ4ku85N54jvLjPPcqB+gFAHfUUUUAFFFFABRRRQAUUUUAFFFFAHA+A8W3j7x3p4BXy7+G5we/nIWz+ld9XA+HVFt8bvGKD/AJfLSymI9SibM/rXfUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAcX8Xr9tO+FGtzJ95o44cYznzJUQj8mNdVpdimmaPZ2EX3LWBIVx6KoUfyri/jAVl8K6bYuwC3+r29uc55+8381rvqACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAPO/jwhf4L60B13W4H43EY/rXoML+bCkg/iUN+Yrz/46uY/g7q5UZbfbkD1InRv6V6BBGIbeOIdEUKPwFAD6KKKACiiigAooooAKKKKACiiigAooooAK4D4LN53w6juf+fi7nk/8fx/Su+JCqSegGTXnnwGO74K6G5zuY3BbI7/aJB/SgD0SiiigAooooAKKKKACiiigAooooA8/tH8r9oe/h/57eH1m/KZVr0CvO2AT9phGBPz+E9pHb/j7yP5GvRKACiiigAooooAKKKKACiiigAooooAKKKKAPOfjCSYfBsY/j8U2YP0KyD+or0avOvjApFv4RlH/ACz8S2pP02yH+YFei0AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAef/GU+b4Jt7DJB1DUYbYAfxE7iB+a16BXn/xGZb3xd4F0QsQZ9W+3BQfvfZlDH6j5s/hXoFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAEV2CbOYL18tsflXB/Awqfg3o/ljC+ZdbRnoPtMtegkZBB6GvO/gONnwZ0aM53RmcNn1Mzn+tAHolFFFABRRRQAUUUUAFFFFABRRRQB51MQf2k4QPvf8Iyp/D7RL/XFei1519/9prgHCeE8E57/a/8Gr0WgAooooAKKKKACiiigAooooAKKKKACiiigDz/AOMrfZ/BNvqBO1bDUYbgt6feUfqwr0CuR+Ktiuo/CvXonyFjtvtBI6jymEmf/HK3PDuo/wBseF9L1LOftlnFP/32gb+tAGlRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAHn8u7WPj9AmFa20LSDJu7pcStt2/Qxtn8K9Arz74Yj+1dW8V+KSARqmpeTC4OQ8EC7Y2/JsfUV6DQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAV5/8GB5XgSS1Ax9lvpYcemNp/rXoFeffCVvLh8W2jKVNt4lvEUE5yny7T7dP0oA9BooooAKKKKACiiigAooooAKKKKAPPtPXzv2gdVmxk2+jLCT6bnjbFeg1594Vf7T8bPHThTttYrGIMTwd0WTj/vnFeg0AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAV9QsotS0y6sbj/VXULwv/uspB/Q1yHwgvprr4cWlte7ReadLLZ3Cr0Rkc4X8FK129efeCgNE+JnjDQCFSO7mXV7cDrIZAPOYj/eKD8DQB6DRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFc54/17/hGvAOramr7JY4CkBAJIkf5EOBycMwP0Bro68+8b/wDFR/EDwz4TjO6KFzq9+obkRR5WMEd1ZiykfQ0AdH4H0EeGPA2k6R5axvbW6+aqDgSt80mPbezVvUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFef+BHFv8SfH+mDjybu2uCPeaNnzXoFcFprJY/HzW7TgPqWiwXvT7wjfyv0/qKAO9ooooAKKKKACiiigAooooAKKKKAPP8A4bMt54l8c6gvJOtvZsfeEYx+TivQK4L4OlLnwXdatFt26tqt3eAqPvZkKk/mld7QAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAV5941I0D4keE/EwwsNzK2jXjbcllkyYueyh9zEnj6V6DXN/EHw83ifwHqemwqTcmLzbba20+anzKARyMkbc+hNAHSUVh+CvEC+KfBemawCpkuIB5wXoJV+WQD2DBvwrcoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAEZgilmIVQMkk8AVwXw3R9b1LX/Gk4O3VrryLDOeLSL5VYAj5Sxzkeq5q18T9Qul8NxaBpDhdU8QzCwgzzsRv9bIRkHaqZyRyMg11OlabbaNpFpptipW3tIVhjBOThRjJPc9ye5oAt0UUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFcF4hI0/41eErsYA1C0urKRiD0VRIoz7sa72uB+K26zg8Na0hVRpuuW7zs2eIWyHH4/LQB31FFFABRRRQAUUUUAFFFFABWV4o1D+yfCOr6gG2m1spplPuqEj9RWrXDfGK5mh+GOoW9oV+1XzxWsIbOGZpFyOP9kNQBofDOwXTfhjoEEYCq1mk2AMY8z950/wCBV1NRWltHZWUFrAMRwRrGg9ABgfyqWgAooooAKKKKACiiigAooooAKKKKACiiigAooooA4DwcD4a+IfiLwtJ8treONX07OTlX4lUdgFYDCjtk139cJ8TrWewtdN8Y6dGXu/DtwJpUXrLat8sy9QPu85PQBq7a2uYby0hurWRZYJ0WSORTkOpGQR7EGgCWiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiuS+ImuXem6HFpmiN/xOtal+xWODgxlvvy8cgIuTnscUAZnhnPi74jap4of5tO0kNpel56O/wDy2lH1PyhgSCp9q9ArO8P6Ja+HPD9lpFgMQWkQQHGC56sx9ySSfcmtGgAooooAKKKKACiiigAooooAKKKKACiiigAooooAK5H4qaaNV+F+uQEA+Xb/AGjnt5TCT+SV11QX1pHqGnXNnOMxXETRP9GBB/nQBW8P6kNY8NaZqQIP2y0inyP9pA39a0K4j4P3k118MdOiu1CXNm0trKgOdhSRsD/vnbXb0AFFFFABRRRQAUUUUAFcD8RSuoeKvBGhkruuNV+3bD/Etuu4/o3+Rmu+rgJidT+P9tEUDQ6PorTB8/dmkk2lce6EGgDv6KKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCOeCK6t5ILiNZIpUKOjDIZSMEH8K4f4bzzaNNqfgnUJGafRZd1m7kkzWbnMZyepXoccDgdq7yuF+IcE+i3On+N9NjZ5tIPl38adZ7Jj8499hO8Z4HJoA7qiora5hvLSG6tZFlgnRZI5EOQ6kZBHsQaloAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAzjrXn/AIPYeM/GF941kG7T7Yvp+i5OVeMHEk4/3mBAPBxkEcVa+Kupz2fhS2061laCXXb+HShMoyYxLncQOOykfjXWaZptto+lW2nWEfl21rEsUa5ycAY5Pc+p7mgC1RRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAHAfDjbp/irxxoYPNvq/23bn7ouE3AD0GF/U139cBDnTPj/cxgKsGr6Ikpbu80cm3H4ICfxrv6ACiiigAooooAKKKKACuA8B41H4geOtZVg6m/i09TnOwwR7WX9VJ+td5NKlvBJNM22ONSzMewAyTXDfBuKQ/DyPUbhNlxqt5cXkw9WaQrn8QgP40Ad5RRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFMmhjubeSC4jWSKRSjo4yGUjBBHpin0UAcF4BuJPD2sal4DvncnTh9p0uSRstPZueOepKNlSTjrgDC5rva8++LbpoOi2fjWEtHeaBcI4Kj/AFsUjCN4z7HcOe3OOteg0AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB578Vojc3vgiAfw+JrSc/wDACf8A4qvQq8/8dSCb4mfD/Tz/AMtrq6nA/wCuUavXoFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAHn3j7Gm/ELwJrbPsRb+XTmHaRrhNqA/TDEV6DXB/GSFx8PZNRgjMk+lXlveQgDkMsgXI+gcn8K7mGZLi3jmhbdHIodWHcEZBoAfRRRQAUUUUAFFFFAHL/ABL1FdK+GWv3LyeVmzeEP/daT92D+bitDwjpraP4L0bTpB+8trKGOTPdwg3H8Tk1y/xexeaDo2hlDIus6zbWsiAf8s925mPsCFP5V6BQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBw3xntftvwh1uDGdwgOPpPGf6V2NhL9o022m/wCekKN+YBrB+I8Xm/DPxFkZ8vT5psf7il//AGWrfgu5+2eAdAuTyZtMtpD+MSmgDbooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAOA1wJe/HbwxCDmTTtOuroj0WQGPP5jFd/XAaMi6j8efEt6V+fStLtbAMR2lJmwPxH6139ABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAGP4u01tY8F6zp8Y/eXNlNHHjs5Q7T+Bwaz/hpqK6p8MtAuEk83bZpAZP7zR/uyfzQ11Fef/CEfYtD1nQtmxNH1m5tYl9Y8hgw9iS1AHoFFFFABRRRQAUUUUAef+JQdT+NHhCwVwU0+3ub+eL+8GXYjfg6/rXoFef6Co1P45+KNQZedLsLbTo3I+8sn70gH2YH8a9AoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAzvEVodQ8L6rZqNxuLOaID13IR/WsP4V3kd98LdBlhbeiW3kgj/pmxT/ANlrra4D4PqLPwxqmjKpRNG1m7skUjHyhg2R7HeTQB39FFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRXP+O9eXwz4F1bVjIsbwW5ETMeBI3ypn23MKAMD4VMdRj8SeIWIcarrErQOB96BMLHz3xyPwrv65/wHoQ8N+AtI0ryvJeC2BljH8EjfO4/76Y10FABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXn/hoHTPjV4usGbCajbW1/BH/dCrsc/i7fpXoFefa+Rpfx08LXwT/kLWFzp8kmPurH+9UE+7MKAPQaKKKACiiigAoorL8TamdG8J6tqa/es7OWZfcqhIH5igDk/hMGvLLxFrjsHGq63cSwOP+eIICD8Pmr0CuS+FumrpXwt0GCNdiyWouNuMY80mXH/j9dbQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVwHhdjpXxi8XaS7AR38VvqVtHjGBt2St75cj8q7+vP/ABiy6B8TvCniEhVivGfRrmQ9cSfNEv8A33knPYUAegUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFef8Ajz/iovGPhvwjCS0f2ganqIABAgjDBVYH+F2DL7EDpXd3d1BY2U93eSrDb28bSyyOcKiKMkn2AGa4j4cWk2q3Wq+NdQjZJdalxZo/WO0XhOO24AE44O1W70Ad5RRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAV5/wDFnNlY+HtcQhBpetW8szntCSQ4/E7RXoFcl8U9MTVvhbr9vKpdUtTcFR1PlESY/wDHKAOtorM8M6i2seFNK1F8h7uzimcHqGZASD75JrToAKKKKACuF+MdzNF8Nbu0s2AutQmhtYN3Qs0gJH4qrCu6rz/4iAal408CaIwYiXVGv+BwDbpvGfqGbr1xQB3drbR2dnDawDbFDGsaD0UDA/lUtFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXL/ABG0GTxF4D1G0tN32yOP7RamP73mJ8wC+hYZXP8AtV1FFAGP4T16PxN4UsNWiIzcRfvQP4ZB8rr+DAitivPfDGPBvxG1LwxO3l2GtM2o6TuPBcD99Ev0ABCjgKuerV6FQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRXO+K/EkulpHpmixLd6/fowsrY/dTj/WyY6Rqevr0HcgAw/GMreMvEEXgfTZT9niMdzr0sTEGGH70cO4dGkIz1BwM8jNd5FFHBCkUKLHHGoVEQYCgcAAdhWN4U8NxeGNGFqJmuryZzPe3jjDXM7fec+nPQdhjr1rboAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACorq2jvLOa2nG6KaNo3HqCMH+dS0UAcL8HLiaT4a2lneOHu9PnmtJyvQMshIH4Ky13VeffDvbp3jbx3oS5Hlaouoc9D9pTdx7AKPpXoNABRRRQAVwB3an+0AOjW+j6J+KzySf1Rq7+vPvh5t1Hxx4811ST5uppp/PQG2TacfXcPrQB6DRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAc1468NTeItBB02TyNXsJRd6dPnG2ZeQpP91uhByOhwcVa8JeJIfFGgpexr5VzE5t722Od1tcLw8ZB5BB9cHBB71t1xfiHTrvw34i/wCEv0GBp4pF2a3YRLl7mJVOyZB3kTjg/eXI4PUA7Siq2najaavpsF/ptwlza3Cb45UPDD+h7EHkHg1ZoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKp6pq+n6JYte6vewWVspwZJ3Cgk9AM9SewHJ7VxJ8S+IfHmI/A0Z0zRXwX129iIaZSM/6PEcE9R8zY/iHykCgDa8S+MRpl/FoehWp1XxDdLmK0Q/JAveWZv4EGR7kkAdci14a8MjRfPvb+4N/rF6Q13euMFvRFH8KDsB9am8OeGNP8MWTw2AllmmIa5u7iQyT3Df3nc8seT+Z9TWxQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBwA3aZ+0Aei2+saL68tPHJ/RFrv689+Ie3TvHHgPXWJHlam+n8dCblNoz9ArfSvQqACiiigCK5uI7S0muZztihRpHPoAMmuK+DltNH8NrW8vECXeozzXc4BzlmkIBz3yqqau/FLU00n4W6/cyvsVrQ25bP3fNIjz/4/Wx4X006N4R0nTW+/aWUUL56llQAn65BoA1aKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA4jU9O1DwVe3Gt+F7OW/wBMnfzdQ0aAZfP8U1uP7/qnRvrgjp9E1zTvEWkxalo10lzayjh16g+hHUH2NaFcdrvgy7TUpNc8E3y6TrD/ADTQyZNpenr+9QdDn+MDPJ7nIAOxoritL+I9pHfJpHjOA+HNYOQsd02ILgDA3Ry/dIJZRgnOTgZINdrQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUVHLPDAu6eVIl9XYD+dAElFYt14z8L2Jxe+I9Jtz6S30Sn9WrKvPiv4HsV3XHiK12/3o1eQfmoNAHX0V56fjP4euI9+hafreuA/dGnWDMx/wCAsVP6U8eOvF2oD/iS/D2+2sOJNQukttv1Rhk/QGgDv6CcDJ4Feemx+Kurhxcatofh+Nv9W1nbm4lT/eWTKk/Q05vhPbaqxbxh4h1nX1YYa2luDFb/AFEacqfcNQBrav8AErwlozmKfWbe4ud2xbazPnyM393CZwfY4rJXxF468UEDw54eTw/ZOAft2uZ87HOQIByrDg/NlTnrXV6N4Y0Pw8pGi6Xa2bEBWkjjG9x/tOfmb8TWrQBxWl/DLTlv49V8V3U3ifV0HFxqA/dRnIJ8uH7iDIBxzgjIxXa0UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAHC/GO2mk+Gt3d2aq13p08N3Bu6BlcAn/AL5Zq7W2uI7u0huITmOZFkQ+oIyKz/FGmnWfCOraag+e7spYUx2ZkIB/PFY/ws1NNW+FugXMT71S0FuGz18omPP/AI5QB1tFFFAHAfFkG+0/QNDUBl1XWreGdT/zxBJY/gdtd/Xn3iHGqfHLwrYB/wDkF2NzqEsf95XHlKT9GUY+teg0AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAFPVNI0/W7BrLV7KC8tmOTHMgYAjoRnoR2I5HauLHgXXvCq/wDFu9d8q0QYXR9X3T249Aj53xgDsM5JyTXoFFAHAL8TLnRHEPj7w5faH1zfQr9ptMZwCZF+6T1C84HU8V1ej+JtE8QKTourWd6QMskMys6f7y9V/EVqEZGDXJ6x8MPCGtyCW50aGCcP5izWZMDB/wC8dmAx9yDQB1lFeff8IB4n0lQPC/j/AFNI1bPk6rEl5uHPyh2HyjpjA4AxSrqHxT0lm+26NomvRA/ILC5NvIw/2jJhc/QYoA9Aorz5vidqWn7RrngHxFATwxsoRdInuXG0Y96enxq8ErMIb/UJ9OnbpFdWkgP5qCP1oA76iuYg+JPgydQw8TabED0+0XAh/wDQ8VrWviHRb8ZsdXsLkf8ATG5R/wCRoA0aKAQwBByD0IooAKKKKACiiigAooooAKKKKAMnxRr0HhjwtqGs3W3ZZwlwrNgO/RFz2yxA/GuG8K/CDw/daPa6x4u01r7xBeoLi8nmmkVt7HdtKqwXIyATjkg+tX/G2fE3jrw/4Pj+a1jY6rqYz1ijOI0I6EM5wRwR8pr0CgDmYPhx4NgXaPDOmyDGMT26y/8Aoea2LTQ9J09s2Gl2Vsc5zDbon8hV6igAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACvP/hKTZ6f4g0Mr5a6VrVxDCmf+WJIKt+J3GvQK8/8Pj+y/jf4psWyBqtlb6hEvYCMCNiPqzEmgD0CiiigDz/w2f7T+Nni2/ZONNtbawhl/vK43uB9HU/nXoFcB8IwbzR9b1xjuGsaxcXULf8ATLICj6Ahvzrv6ACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAprxpKhSRFdT1VhkGnUUAY9z4P8NXrZvPD2lTnIbMllGxyOhyR1rKufhb4KulIk8PWqg9REWjH5KRXW0UAeWW+g6b8KviHpA0KJrPQPEGbGeFpWdUu87omy5LFm+6BnA+Y16nXOePvDz+JvBV/YW2Reqnn2bq20rMnzJg9skbc+jGpvBfiFfFPg3TtXwFlnhAnUAjbKvyuMHnG4HHtg0AbtFFFABRRRQAUUUUAFNllSGF5ZnVI0UszMcBQOpNOrhvi5qr2PgaSxgkWGXVpVsfOdSyRIwJdmxjjYrD8aAIvhlE+rvrXjS6DeZrt0RbK4YGO1iykY2n7p4OcdcA131Z2gDS00Gzg0G4huNPt4lgheCUSLtUAAbh1PFaNABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXn3iQ/wBl/Gzwlfqny6la3NhNJ/dCjeg/F2H5V6DXAfF1hY6Lo2unaF0jWLe5lc54jyQR+J20Ad/WR4t1JtH8G6xqMf8ArLaylkjHq4Q7R+JwK164T4x3Ei/DyWwtioudTuoLODdnli4bHHqEIoA0fhlpyaV8MdBt44/KDWiz7MfdMuZCPzc11VR28EdrbRQQrtjiQIg9ABgVJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVwHhgf8Iv8Ttd8OM22z1b/ib2C4OFY/LMmenUZCjoq+9d/Xm/xW1HT9JuNE1uK7tv7Z0W7EyWvmAzS27jbKqrkEZAHzHgDPrQB6RRTUdZI1dOVYAjjHFOoAKKKKACiiigAqO4t4bu3eC6hjmhkGHjkUMrD0IPBqSigDidQ+FWhS3bXugy3vhy+OMz6VOYgwBJClPu7ck8ADOaqkfEvw0PkOn+MLRc8Nizuj6D+5gDvyTXoFFAHC2vxZ0NLpLPxLbX/hu8YlVj1O3ZEcjqVcZBX3OK7OzvrTUbVLnT7qG6t3+7LBIHVvoRwaW7s7a/tnt763iuYHGHimQOrD3B4NcZefCXw/8AamvPD0t94bvWwTNpVw0QbHRSnK7fYAUAdzRXn5i+JvhuM+TLpvjC3XJCyYsrpvRQf9X/AMCJz7c0+H4taVaTrbeLNN1Pw3cM/lr9utmMUjYz8jqDuH+0QBwaAO9oqppuradrFqLnSb62voD/AMtLeVZF/MGrdABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXLfEzT11L4Z67Cyl/LtWuAo6kxESAD3ygrqajuII7q1lt5l3RyoUceoIwaAMzwnqDat4O0i/dg0lxZxPIR/f2Dd+ua5bx+RqPjzwNoh+ZX1B79gM/Kbdd6k/+PD61J8GppP8AhXUVhcyeZc6ZdT2k59GDl8fgHA/Co4gdT/aBnfcGg0jRVjK/3Jnfdn8Ucj8KAPQKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiuf1/x34Y8MK/9t61a20kYy0IbfKB6+WuW/SgDoKK8/wD+Fha7rjbPBfgy/uYycfbtTYWsGCMh1zzIvbAIPX0pT4P8Z+ISW8V+L20+3brY6AnlBef+e7DeR2IIoA6fXfFugeGoy2u6ta2ZC7hG8mZGHqEGWP4CuX/4WRqWufL4G8J6hqcbY2316PstuQf4lLcv9ODWzofw58KeHpBNYaPA9zu3m5uczS7j1YM+dpPtiunoA8//AOER8aeIhnxZ4sOnQMPmsdAUxAf9tm+bnoQQRW7oPgDwz4cZZdM0qH7SGL/aZ/3su4kksGbJBJJ6Yro6KACiiigAooooAKKKKACiiigAooooAKKKKACmTQxXELRXEaSxuMMjqGVh6EGn0UAcZqPwo8K3kxubG0m0S8xhbnSJ2tWT3AX5c++3NUm8OfEPQsnw/wCK7bWYFwEtdct/mA7/AL1PmZj74Ga9AooA89/4WLrmjNs8YeCdRtUBx9r09luYsf32IwEHsWJrb0T4keEfEAQabrtqZHOFinYwux7gK+C34Zrp6xdZ8HeHfEBZtY0WzupGGDM0QEgHs4ww/A0AbVFcAvwrj0lf+KL8S6z4fCrtjtln+0Wye/lSZyfxpp/4WnoZ4Oi+J7dR/dNrcyH8xGo/OgD0GivPR8VJtNITxZ4Q1rSDjLzxx+fbx/WX5c/gDW1pHxL8Ha4kbWHiGzzL/q1ncwM/0WTBP4UAdRRSKwZQykFSMgg9aWgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACis7V/EGkaBAJta1K1sUb7vnyhS/so6sfYVyX/AAs99awngPw7qGv7jhbt1+zWo5wSZH5yOuMDPagBPAKLpnjvxzoyJsQahHqA/wBtrhNzEfkoz/hR8PEW+8XeONc2/NcaqLHdn7wt12gjtjDDp/StPwt4d1e31q98Q+Jp7X+072NYTb2IPkxRqflGW5ZunP16jGMiLTvFvgOW6GgadbeItHmna4MHneRdxsx+Y5I2uAOfU9BjgUAeh0VxVh8V/DU92LLV5bjQL7G422rwmAgeu4/KB9SD7V2UM0VxCstvIksbjKujBlYeoI60APooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiq1/qVjpduZ9TvbezhHWS4lWNfzJAoAs0VxF/8X/B1nci1ttQk1O7YFkgsIWlMg/2W4U/99VUXx14v1nb/AMI34DvIYnH+v1iUW5j+sRwT/wABY0AehVBeXtrp9s1xf3MNrAn3pZpAir9SeK4ePw/8RtYKtrni2y0ePPz22jWe/cPaST5lP0zU1p8IvDCXKXesC+1+9QEC51a7eZiD1BHCkfUUAGofF7wrbXDWumTXOuXgXcttpUBmZx6qeFb8Car/APCQ/EXXuNC8MWWiQEjbc6zOWZl7/u0AZW9iCK7iw02x0q2Fvpdlb2UA6RW8SxqPwUAVZoA4AfDrWNXIbxj411S/XJJtLDFnAQf4GC8uPfg10Gh+BfDHhsq2jaLawSr0nZfMl/7+Plv1rfooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACsbVfB/h3XHaTVdEsbmVuszwL5g+jj5h+dbNFAHn//AAp/RrFt3hfVda8PEMW2WF83luT/AHg2Sw9s0h8O/ErS97aV4x0/Vlz+6g1Ww8tUHoXjyzfXIr0GigDgB4l+IumFV1XwTa6mgH7y40vUFUD6RvljTf8AhcOl2W//AISLQtf0JY/vS31gRGfdSCSw98V6DRQByth8TvBeooHg8R2UQPT7Uxtz+UgWuitL+zv4/MsbqC5T+9DIHH5iqWoeFfD+qknVNC028J5zPaRufzIrnb34OeBb2dZ20JYJl+5Jb3EsW36BWA/SgDt6K4H/AIVWLWQvo/jLxRYDGBCL/wAyEf8AACP60f8ACH+PbaQGx+JDNGP+WN3o8Umf+B5DUAd9RXCPb/Fa2XbbX3hS+5+9dQXELH/vgkfpSHVvidbL++8M6LeMO9rfFAf++8UAd5RXnjeL/iRFkN8MVmGOGj12BR+RBNA8eeNk/wCPn4bzx/7upeZ/6DEaAPQ6K88PxE8Rr9/wHfD6NOf5W9IfiRrwH/Ii6jn/AHLn/wCR6APRKK88HxF8Rsfk8CXx47m4X+duKafHvjRv9R8OpX9N1+6fzgoA9Forz1PF3xHnkYR/DdYU/hkl1iE5+o4I/KpWv/ipdL/omjeHLFu3225kcD/v3QB3tFefyaF8T9RT/SPF+laQx6/2fpvngfTzef1oPwx1C/ZW1zx54iuCPvJZXH2WN/8AeUbhj2oA7a/1Sw0qHztUvrayi/v3Eyxr+bEVyt98XPBdlcLbR6uL64k/1cVjC8/mfRlG0/nTbL4Q+C7O6a6fSmu7l/8AWTXdxJKZPqpbafyrq9O0nTtIg8jSdPtbGL/nnbQrGv5KBQBxQ8deK9Z2jwv4Evo42yPtOtSLahPfy+rA+xzilTwx4/1oq3iPxhBpcLAiSz0K22591mf51Nd/RQByGkfC7wppNwbp9O/tK+Ygveak5uZHYdG+bgH3AFdeAFAAGAOAB2oooAKKKKAKuo6XYavam11Wyt72BusVxEsi/kRXHSfCnTLK4e58I6nqXhu4clmWzuC0Lse7RtkH6ZAru6KAPP8Ay/iloIG2bR/Fdui870+x3Mh9sfu1H50o+Ki6blfF3hjWtDKruknNuZ7dfYSp1P0Fd/RQBzGl/EjwdrCRtY+IrDMn3Fml8ln+ivgn8q6ZHWRA8bBlYZDKcg1jap4O8OazI0up6JYzzMCDOYFEn/fYww/Ouab4NeGYFk/sK51jQGkO5pNM1GRGz65bdQB39FefN4C8XWSquhfEfUIlU9L+0S7Zh6FnP64pzWvxYssC11DwvqaD7zXkM0Tn6bOKAO/orgm1v4mW3+s8J6ZekHk21+I8j23mq48bfEGMEXPwzKEHgjWI2BH/AABG9qAPRaK88X4geLF/4+Ph9cpx/Bcyv/KCk/4WR4gH3vAt+D6Bbk/+21AHolFeeH4j6+fu+BdRP1W4H/tvR/wsLxQ2PJ8AXjk9jNKn/oUAoA9Dorzv/hOPHzsPI+GEki55J1mNDj/gaCnx+KPiVP8A808t7X/rrrMUmP8AvmgD0GiuCa7+K1yM22meF7L2u7iZyP8Avgc/nT30n4m3ynzvE+iaWT0+xaa023/v43NAHdUVwKeA/FdyMav8R9Tn9TZ2kVqfw25po+Dmg3MZTXdU1/XVPX+0dTd8/iu00Adbf+JdD0ttup6zp9m2cbbi6RDn6E1zd98YfBFjMsP9sfaZnOEjtoJJN59AwXb+tW7D4W+B9OjWODwzYOi9Bcx+fj/v5uro7LTbHTo9mn2VvaJ/dgiVB+QFAHED4m6jqO5fD3gPxDeMPuvdxLaxSf7rsSMe9H234q6rsNtpOgaDG331vLl7iVB/smP5SfqK9AooA8+/4QPxbqauPEXxD1Hy36R6TAlm0Y9BIvJ+pFWrH4Q+D7W5+1XdhLql2Rte41C4eVnH+0udp/Ku3ooAq6fpdhpNv5Gl2NtZQ/8APO2hWNfyUAVaoooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/2Q==
EOF_IMG

echo '📦 Установка компонентов (Node.js, npm, PM2)...'
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nodejs npm ufw coreutils
npm install -g pm2

echo '🛡️ Настройка брандмауэра UFW...'
ufw allow 80/tcp || true
ufw allow 8080/tcp || true
ufw allow 22/tcp || true
echo y | ufw enable || true

echo '⚡ Запуск CRM службы через PM2 (порт 80)...'
pm2 delete topordorf-crm || true
CRM_PASSWORD=7417 PORT=80 pm2 start server.js --name topordorf-crm
CRM_PASSWORD=7417 PORT=8080 pm2 start server.js --name topordorf-crm-8080 || true
pm2 save
pm2 startup systemd -u root --hp /root || true

IP=$(hostname -I | awk '{print $1}')
echo ''
echo '=================================================='
echo '🎉 CRM ТОПОРДОРФ УСПЕШНО РАЗВЕРНУТА И ЗАПУЩЕНА!'
echo "🌐 Ссылка для входа в браузер: http://$IP"
echo "🌐 Альтернативный порт: http://$IP:8080"
echo '🔑 Пароль от CRM: 7417'
echo '=================================================='
