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
