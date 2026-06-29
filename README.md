# AI Chatbot Setup (Laravel 13 & ReactJS)

This repository contains a decoupled setup for an AI Chatbot project, featuring a **Laravel 13** backend, a **ReactJS (Vite)** frontend, and a **docs** folder for documentation.

## Project Directory Structure

```text
AI-Chatbot/
├── backend/             # Laravel 13 API Backend
├── frontend/            # ReactJS + Vite Frontend (UI/UX)
└── docs/                # Project Documentation & API Specs
```

---

## Quick Start Guide

### 1. Run the Backend (Laravel 13)
The backend is pre-configured with a local SQLite database and Laravel Sanctum for API token authentication.

```bash
cd backend
php artisan serve
```
*The backend server will run at `http://127.0.0.1:8000`.*

### 2. Run the Frontend (ReactJS + Vite)
The frontend is built with React, Vite, and Lucide icons, styled with a premium dark glassmorphism theme.

```bash
cd frontend
npm run dev
```
*The frontend development server will run at `http://localhost:5173`.*

---

## Features Built-In

1. **Authentication Flow**: Pre-configured Register, Login, and Logout API endpoints using Laravel Sanctum.
2. **Dynamic Chat Interface**: A beautiful glassmorphic UI with chat history, model selection (Gemini/Claude), message bubbles, code formatting with copy-to-clipboard, and typing animations.
3. **Dual Modes**:
   - **Sandbox Mode (Fallback)**: Works immediately out of the box with responsive mock AI answers without running any backend servers.
   - **Live Mode**: Automatically connects and communicates with the Laravel backend API once the server is running.
4. **CORS Pre-configured**: CORS is configured in `backend/config/cors.php` to allow local cross-origin requests from the React development server.

---

## Documentation

For more detailed guides, check out the `docs` folder:
- [General Documentation](file:///c:/xampp/htdocs/AI-Chatbot/docs/README.md)
- [API Endpoint Specification](file:///c:/xampp/htdocs/AI-Chatbot/docs/api-endpoints.md)
