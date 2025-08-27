# Trading Info Mini App

Telegram Mini App for educational trading content with an Obsidian-like interface.

## Features

- 📚 Interactive lesson viewer with markdown support
- 🖼️ Image support for educational content
- 📱 Mobile-friendly Telegram Mini App interface
- 🔍 Search functionality across lessons
- 📋 Tables and rich markdown formatting
- 🌙 Dark theme interface

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Backend**: Node.js, Express
- **Markdown**: react-markdown with GitHub Flavored Markdown
- **Styling**: CSS Variables, Responsive Design
- **Deployment**: Render

## Development

### Prerequisites
- Node.js 16+
- npm

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend development server on `http://localhost:3000`

### Build for Production

```bash
npm run build
npm start
```

## Deployment on Render

1. Push your code to GitHub
2. Connect your GitHub repository to Render
3. Render will automatically:
   - Install dependencies
   - Build the React app
   - Start the Express server
   - Serve both API and static files

## Project Structure

```
├── server.js              # Express backend
├── package.json           # Backend dependencies
├── lessons/               # Markdown lesson files and images
├── client/                # React frontend
│   ├── src/
│   ├── public/
│   └── package.json      # Frontend dependencies
└── render.yaml           # Render deployment config
```

## API Endpoints

- `GET /api/lessons/structure` - Get lesson tree structure
- `GET /api/lessons/content/*` - Get lesson markdown content
- `GET /api/image/:encodedPath` - Serve lesson images
- `GET /api/lessons/search?q=query` - Search lessons

## Telegram Mini App Integration

The app is designed to work as a Telegram Mini App with:
- WebApp API integration
- Theme adaptation
- Mobile-optimized interface