// ============================================
// app.js — Логика приложения
// Навигация, рендер экранов, интеграция с Telegram SDK
// ============================================

// Объект Telegram Web App — реальный только если запущено внутри Telegram
// SDK грузится всегда, но platform === 'unknown' означает обычный браузер
const _tgRaw = window.Telegram?.WebApp || null;
const tg = (_tgRaw && _tgRaw.platform && _tgRaw.platform !== 'unknown') ? _tgRaw : null;

// Состояние приложения
const state = {
  screen: 'catalog',   // текущий экран
  history: [],         // стек для кнопки «Назад»
  booking: {
    service: null,     // выбранная услуга
    date: null,        // дата (строка YYYY-MM-DD)
    time: null,        // время (строка HH:MM)
  },
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

function init() {
  if (tg) {
    tg.ready();
    tg.expand(); // разворачиваем на весь экран
    tg.BackButton.onClick(goBack);
    applyTheme();
    tg.onEvent('themeChanged', applyTheme);
  }
  renderCatalog();
}

function applyTheme() {
  document.body.classList.toggle('dark', tg?.colorScheme === 'dark');
}

// ============================================
// НАВИГАЦИЯ
// ============================================

function navigate(targetId) {
  const fromEl = document.getElementById(`screen-${state.screen}`);
  const toEl   = document.getElementById(`screen-${targetId}`);

  // Убираем метку анимации «назад» у всех экранов
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('go-back'));

  fromEl.classList.remove('active');
  toEl.classList.add('active');
  toEl.scrollTop = 0;

  state.history.push(state.screen);
  state.screen = targetId;

  if (tg) {
    tg.BackButton.show();
  } else {
    // В браузере — добавляем HTML-кнопку «Назад» в начало экрана
    renderBrowserBackButton(toEl);
  }
}

function renderBrowserBackButton(screenEl) {
  // Удаляем старую кнопку если есть
  const old = screenEl.querySelector('.back-btn');
  if (old) old.remove();

  const btn = document.createElement('button');
  btn.className = 'back-btn';
  btn.innerHTML = '‹ Назад';
  btn.onclick = goBack;
  screenEl.insertBefore(btn, screenEl.firstChild);
}

function goBack() {
  if (!state.history.length) return;

  const fromEl = document.getElementById(`screen-${state.screen}`);
  const prevId = state.history[state.history.length - 1];
  const toEl   = document.getElementById(`screen-${prevId}`);

  fromEl.classList.remove('active');
  toEl.classList.add('go-back', 'active'); // анимация возврата (справа налево)
  toEl.scrollTop = 0;

  state.history.pop();
  state.screen = prevId;

  // Убираем BackButton на главном экране
  if (tg && state.history.length === 0) {
    tg.BackButton.hide();
  } else if (!tg && state.history.length === 0) {
    const btn = toEl.querySelector('.back-btn');
    if (btn) btn.remove();
  }

  // Восстанавливаем MainButton для экрана на который вернулись
  updateMainButtonForScreen(prevId);
}

// Настраивает MainButton в зависимости от экрана
function updateMainButtonForScreen(screenId) {
  if (!tg) return;
  if (screenId === 'catalog') {
    tg.MainButton.hide();
  } else if (screenId === 'service') {
    setupMainButton('Записаться', toDatetime);
  } else if (screenId === 'datetime') {
    if (state.booking.date && state.booking.time) {
      setupMainButton('Выбрать', toConfirm);
    } else {
      tg.MainButton.hide();
    }
  } else if (screenId === 'confirm') {
    setupMainButton('Подтвердить запись', submitBooking);
  } else {
    tg.MainButton.hide();
  }
}

// ============================================
// TELEGRAM MAINBUTTON
// ============================================

function setupMainButton(text, onClickFn) {
  if (!tg) return;
  // Удаляем старые обработчики заменой — offClick + onClick
  tg.MainButton.offClick(toDatetime);
  tg.MainButton.offClick(toConfirm);
  tg.MainButton.offClick(submitBooking);
  tg.MainButton.onClick(onClickFn);
  tg.MainButton.setText(text);
  tg.MainButton.show();
}

function hideMainButton() {
  if (tg) tg.MainButton.hide();
}

// ============================================
// ЭКРАН 1 — КАТАЛОГ УСЛУГ
// ============================================

function renderCatalog() {
  // Шапка с именем мастера
  document.getElementById('master-header').innerHTML = `
    <div class="master-header">
      <div class="master-avatar">${MASTER.initials}</div>
      <div class="master-info">
        <h1>${MASTER.name}</h1>
        <p>${MASTER.title} · ${MASTER.experience}</p>
      </div>
    </div>
  `;

  // Карточки услуг — полностью кликабельны
  document.getElementById('services-list').innerHTML = SERVICES.map(s => `
    <div class="service-card" onclick="openService(${s.id})">
      <div class="service-card-image" style="background:${s.gradient}">${s.icon}</div>
      <div class="service-card-body">
        <p class="service-card-cat">${s.category}</p>
        <p class="service-card-name">${s.name}</p>
        <div class="service-card-footer">
          <span class="service-card-price">${formatPrice(s.price)}</span>
          <span class="service-card-dur">⏱ ${s.duration} мин</span>
          <span class="service-card-arrow">›</span>
        </div>
      </div>
    </div>
  `).join('');

  hideMainButton();
}

// ============================================
// ЭКРАН 2 — КАРТОЧКА УСЛУГИ
// ============================================

function openService(id) {
  const service = SERVICES.find(s => s.id === id);
  if (!service) return;

  // Сохраняем выбор, сбрасываем дату и время
  state.booking.service = service;
  state.booking.date = null;
  state.booking.time = null;

  document.getElementById('service-detail').innerHTML = `
    <div class="service-hero-img" style="background:${service.gradient}">${service.icon}</div>
    <div class="service-info-block">
      <span class="service-badge">${service.category}</span>
      <h2 class="service-name-big">${service.name}</h2>
      <div class="service-price-row">
        <span class="service-price-big">${formatPrice(service.price)}</span>
        <span class="service-dur-big">⏱ ${service.duration} мин</span>
      </div>
    </div>
    <p class="service-section-head" style="padding:4px 16px 6px">О процедуре</p>
    <p class="service-desc">${service.description}</p>
    <div class="service-result-block">
      <p class="service-result-label">Результат</p>
      <p>${service.result}</p>
    </div>
    <p class="service-section-head" style="padding:4px 16px 8px">Отзыв клиента</p>
    <div class="service-review-block">
      <p class="review-quote">"</p>
      <p class="review-text">${service.review.text}</p>
      <p class="review-author">— ${service.review.author}</p>
    </div>
    <button class="btn-primary" id="btn-book" onclick="toDatetime()">Записаться</button>
  `;

  // В Telegram скрываем внутреннюю кнопку — используем MainButton
  if (tg) {
    document.getElementById('btn-book').style.display = 'none';
    setupMainButton('Записаться', toDatetime);
  }

  navigate('service');
}

// ============================================
// ЭКРАН 3 — ВЫБОР ДАТЫ И ВРЕМЕНИ
// ============================================

function toDatetime() {
  const service = state.booking.service;

  document.getElementById('datetime-content').innerHTML = `
    <div class="screen-top">
      <h2>Выбор даты</h2>
      <p>${service.name} · ${formatPrice(service.price)}</p>
    </div>
    <div class="dt-section" style="padding-top:16px">
      <p class="dt-section-label">Дата</p>
      <div class="dates-grid" id="dates-grid"></div>
    </div>
    <div id="times-wrap" style="display:none">
      <div class="dt-section">
        <p class="dt-section-label">Время</p>
        <div class="times-grid" id="times-grid"></div>
      </div>
      <button class="btn-primary" id="btn-time" onclick="toConfirm()" style="display:none; margin-bottom:24px">
        Выбрать
      </button>
    </div>
    <p class="pick-date-hint" id="pick-hint">Выберите дату, чтобы увидеть свободное время</p>
  `;

  renderDates();
  hideMainButton();
  navigate('datetime');
}

function renderDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const grid = document.getElementById('dates-grid');

  const chips = [];
  // Показываем 14 дней, начиная с завтра
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dow = d.getDay();
    const off = DAYS_OFF.includes(dow);

    chips.push(`
      <div class="date-chip ${off ? 'unavailable' : ''} ${dateStr === state.booking.date ? 'selected' : ''}"
           onclick="selectDate('${dateStr}')" data-date="${dateStr}">
        <span class="date-chip-wd">${RU.weekdays[dow]}</span>
        <span class="date-chip-num">${d.getDate()}</span>
        <span class="date-chip-mo">${RU.monthsShort[d.getMonth()]}</span>
      </div>
    `);
  }
  grid.innerHTML = chips.join('');
}

function selectDate(dateStr) {
  state.booking.date = dateStr;
  state.booking.time = null;
  hideMainButton();

  // Подсвечиваем выбранную дату
  document.querySelectorAll('.date-chip').forEach(el => {
    el.classList.toggle('selected', el.dataset.date === dateStr);
  });

  // Показываем блок со временем
  document.getElementById('times-wrap').style.display = 'block';
  document.getElementById('pick-hint').style.display = 'none';
  if (document.getElementById('btn-time')) {
    document.getElementById('btn-time').style.display = 'none';
  }

  renderTimes(dateStr);
}

function renderTimes(dateStr) {
  const grid = document.getElementById('times-grid');
  grid.innerHTML = TIME_SLOTS.map(t => {
    const taken = isSlotTaken(dateStr, t);
    const selected = t === state.booking.time;
    return `
      <div class="time-chip ${taken ? 'taken' : ''} ${selected ? 'selected' : ''}"
           onclick="${taken ? '' : `selectTime('${t}')`}" data-time="${t}">
        ${t}
      </div>
    `;
  }).join('');
}

function selectTime(time) {
  state.booking.time = time;

  document.querySelectorAll('.time-chip:not(.taken)').forEach(el => {
    el.classList.toggle('selected', el.dataset.time === time);
  });

  // Показываем кнопку «Выбрать»
  if (tg) {
    setupMainButton('Выбрать', toConfirm);
  } else {
    const btn = document.getElementById('btn-time');
    if (btn) btn.style.display = 'block';
  }
}

// ============================================
// ЭКРАН 4 — ПОДТВЕРЖДЕНИЕ
// ============================================

function toConfirm() {
  if (!state.booking.date || !state.booking.time) return;
  const { service, date, time } = state.booking;

  document.getElementById('confirm-content').innerHTML = `
    <div class="screen-top">
      <h2>Подтверждение</h2>
      <p>Проверьте детали перед записью</p>
    </div>
    <div class="confirm-card">
      <div class="confirm-stripe"></div>
      <div class="confirm-body">
        <p class="confirm-subtitle">Ваша запись</p>
        <div class="confirm-row">
          <span class="confirm-label">Процедура</span>
          <span class="confirm-value">${service.name}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Дата</span>
          <span class="confirm-value">${formatDateLong(date)}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Время</span>
          <span class="confirm-value">${time}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Длительность</span>
          <span class="confirm-value">${service.duration} мин</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Стоимость</span>
          <span class="confirm-value confirm-price-value">${formatPrice(service.price)}</span>
        </div>
      </div>
    </div>
    <p class="confirm-note">
      После подтверждения придёт сообщение в этот чат с деталями. Напоминание — за 24 часа до визита.
    </p>
    <button class="btn-primary" onclick="submitBooking()" id="btn-confirm" ${tg ? 'style="display:none"' : ''}>
      Подтвердить запись
    </button>
  `;

  if (tg) {
    setupMainButton('Подтвердить запись', submitBooking);
  }

  navigate('confirm');
}

// ============================================
// ЭКРАН 5 — УСПЕХ
// ============================================

function submitBooking() {
  const { service, date, time } = state.booking;

  // Отправляем данные боту и закрываем Mini App
  if (tg) {
    try {
      tg.sendData(JSON.stringify({
        action: 'booking',
        service: service.name,
        date,
        time,
        price: service.price,
        duration: service.duration,
      }));
      // sendData закрывает Mini App — если сработало, до renderSuccess не дойдём
      // Но если контекст не поддерживает sendData — показываем экран успеха
    } catch (e) {
      // Продолжаем без отправки
    }
  }

  document.getElementById('success-content').innerHTML = `
    <div class="success-wrap">
      <div class="success-circle">
        <svg class="success-check" viewBox="0 0 24 24">
          <polyline points="4,12 9,17 20,7"/>
        </svg>
      </div>
      <h2 class="success-title">Вы записаны!</h2>
      <p class="success-sub">Детали отправлены в ваш чат. Напоминание придёт за сутки.</p>
      <div class="success-card">
        <div class="success-row">
          <span class="success-icon">${service.icon}</span>
          <div class="success-text">
            <strong>${service.name}</strong>
            <span>${service.duration} мин · ${service.category}</span>
          </div>
        </div>
        <div class="success-row">
          <span class="success-icon">📅</span>
          <div class="success-text">
            <strong>${formatDateLong(date)}</strong>
            <span>Дата процедуры</span>
          </div>
        </div>
        <div class="success-row">
          <span class="success-icon">🕐</span>
          <div class="success-text">
            <strong>${time}</strong>
            <span>Время начала</span>
          </div>
        </div>
        <div class="success-row">
          <span class="success-icon">💳</span>
          <div class="success-text">
            <strong>${formatPrice(service.price)}</strong>
            <span>Оплата на месте</span>
          </div>
        </div>
      </div>
      <p class="success-note">
        Через <strong>3 недели</strong> бот напомнит вам записаться снова — кожа скажет спасибо 🌿
      </p>
    </div>
  `;

  navigate('success');
  hideMainButton();
  // На экране успеха BackButton тоже скрываем
  if (tg) tg.BackButton.hide();
}

// ============================================
// СТАРТ — ждём загрузки DOM
// ============================================
window.addEventListener('DOMContentLoaded', init);
