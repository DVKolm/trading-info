# Trading Info Frontend

React-based frontend application for the Trading Info educational platform.

## Prerequisites

- Node.js 16+
- npm or yarn

## Setup

1. Install dependencies:
```bash
npm install-client
```

2. Configure environment:
- Development: Edit `client/.env`
- Production: Edit `client/.env.production`

Default API endpoint: `http://localhost:3001` (Spring Boot backend)

## Development

Start the development server:
```bash
npm start
```

The application will run on http://localhost:3000

## Production Build

Build for production:
```bash
npm run build
```

The build artifacts will be stored in the `client/build/` directory.

## Deployment

Serve the production build:
```bash
npm run serve
```

Or deploy the `client/build/` folder to any static hosting service.

## Backend Integration

This frontend requires the Spring Boot backend running on port 3001.
Backend repository: `trading-info-backend`

## Environment Variables

- `REACT_APP_API_URL`: Backend API URL (default: http://localhost:3001)

## Features

- 📚 Lesson viewer with Markdown support
- 🔍 Full-text search
- 📊 Progress tracking
- 🎨 Dark/Light theme
- 📱 Mobile-responsive design
- 🔐 Telegram authentication

## Technology Stack

- React 18
- TypeScript
- Material-UI
- Marked (Markdown parser)
- Telegram WebApp SDK