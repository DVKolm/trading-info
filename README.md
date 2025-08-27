# Trading Education Telegram Mini App

Telegram Mini App для обучения трейдингу с интерфейсом в стиле Obsidian.

## Особенности

- 🌙 **Тёмная тема** в стиле Obsidian
- 📱 **Telegram Mini App** - нативная интеграция с Telegram
- 🗂️ **Древовидная навигация** - организация уроков по папкам
- 🔍 **Быстрый поиск** - мгновенный поиск по урокам
- 📖 **Markdown рендеринг** - поддержка всего синтаксиса Markdown
- 🔗 **Внутренние ссылки** - поддержка Obsidian-style ссылок `[[Название урока]]`
- 💫 **Плавные анимации** - анимации в стиле Obsidian

## Структура проекта

```
├── server.js              # Express backend
├── client/                # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.tsx    # Боковая панель навигации
│   │   │   └── LessonViewer.tsx # Просмотрщик уроков
│   │   ├── App.tsx
│   │   └── types.ts
├── lessons/               # Папки с уроками (Markdown файлы)
└── package.json
```

## Установка и запуск

1. **Установка зависимостей:**
   ```bash
   npm install
   cd client && npm install
   cd ..
   ```

2. **Запуск в режиме разработки:**
   ```bash
   npm run dev
   ```

3. **Сборка для продакшена:**
   ```bash
   npm run build
   npm start
   ```

## Работа с уроками

### Структура уроков

Уроки организованы в папки в директории `lessons/`. Каждая папка представляет модуль обучения.

### Формат Markdown файлов

Каждый урок должен быть в формате Markdown с frontmatter:

```markdown
---
title: "Название урока"
description: "Краткое описание"
tags: ["тег1", "тег2"]
---

# Основной контент урока
```

### Внутренние ссылки

Используйте Obsidian-style ссылки для связи между уроками:

```markdown
Смотрите также: [[Урок 2. Мастерство трендовых линий]]

Подробнее в разделе [[Чек-лист]]
```

## API Endpoints

- `GET /api/lessons/structure` - Получить структуру уроков
- `GET /api/lessons/content/*` - Получить содержимое урока
- `GET /api/lessons/search?q=query` - Поиск по урокам
- `GET /api/lessons/resolve/:linkName` - Разрешить внутреннюю ссылку

## Telegram Mini App

Для использования в качестве Telegram Mini App:

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Настройте Menu Button на URL вашего приложения
3. Приложение автоматически интегрируется с Telegram Web App API

## Технологии

- **Backend:** Node.js, Express, marked, gray-matter
- **Frontend:** React, TypeScript, react-markdown, Telegram Mini App SDK
- **Стили:** CSS Custom Properties, Obsidian-inspired design