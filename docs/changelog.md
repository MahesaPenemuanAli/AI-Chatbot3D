# Development Changelog

All notable changes to the AI Chatbot project will be documented here.

## [2026-06-29]

### Added
- Created database models: `Avatar`, `AvatarAnimation`, `MessageAttachment`, and `UserPreference`.
- Updated database models: `ChatSession` and `ChatMessage` to support multimodal media and 3D animation metadata.
- Created and executed migrations for all 10 tables in the SQLite database.
- Configured `GEMINI_API_KEY` placeholder in `backend/.env`.
- Updated `backend/app/Http/Controllers/Api/ChatController.php` with Gemini API integration, model fallback list (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`), exponential backoff, and database storage.
- Added API endpoints for listing sessions, retrieving session messages, and deleting sessions in `backend/routes/api.php`.
- Designed UI/UX development stages for the Tourism Guide Chatbot in `docs/changelog.md`.
- Implemented **Stage 1 (Core Layout and Theme)** in the React frontend: updated `frontend/src/index.css` and `frontend/src/App.jsx` with a modern tropical-emerald tourism theme (no code comments).
