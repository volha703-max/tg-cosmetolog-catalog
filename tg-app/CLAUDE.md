# CLAUDE.md — tg-app (Telegram Mini App)

## Что это

Telegram Mini App — каталог услуг косметолога Анны. 5 экранов: каталог → услуга → дата/время → подтверждение → успех.
Написано на чистом HTML + CSS + JS, без фреймворков.

## Файлы

| Файл | Что делает |
|---|---|
| `index.html` | Точка входа. Только HTML-скелет, весь контент рендерит JS |
| `style.css` | Все стили. Переменные CSS адаптируются под тему Telegram |
| `data.js` | **Здесь менять контент** — услуги, имя мастера, слоты времени |
| `app.js` | Логика: навигация, рендер экранов, Telegram SDK |

## Навигация между экранами

```
screen-catalog → screen-service → screen-datetime → screen-confirm → screen-success
```

- Вперёд: `navigate('id-экрана')`
- Назад: `goBack()` — вызывается автоматически кнопкой Telegram BackButton
- Переход на datetime: всегда через `renderDatetime()` + `navigate('datetime')`

## Где менять данные (data.js)

**Имя мастера:**
```js
const MASTER = { name: 'Анна', title: '...', experience: '...' }
```

**Услуги — добавить/удалить:**
```js
const SERVICES = [ { id, name, price, duration, category, gradient, icon, description, result, review } ]
```

**Рабочие часы:**
```js
const TIME_SLOTS = ['10:00', '11:00', ...]
```

**Выходные дни:**
```js
const DAYS_OFF = [0] // 0 = воскресенье, 6 = суббота
```

## Telegram SDK

- `tg.expand()` — разворачивает на весь экран при старте
- `tg.BackButton` — нативная кнопка "Назад"
- `tg.MainButton` — синяя кнопка внизу для главного действия
- `tg.sendData()` — отправляет данные бронирования боту
- `tg.colorScheme` — определяет тёмную/светлую тему

## Тёмная тема

Цвета берутся из CSS-переменных Telegram (`--tg-theme-bg-color` и др.).
При смене темы JS добавляет/убирает класс `.dark` на `<body>`.

## Как тестировать в браузере

Открыть `index.html` напрямую — SDK не подключён, работают резервные кнопки внутри экранов.
Для теста в Telegram: нужен HTTPS-хостинг и бот с настроенным Menu Button.
