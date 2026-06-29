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
- Implemented **Stage 2 (3D Avatar Canvas Integration)**: installed `three`, `@react-three/fiber`, `@react-three/drei`, and `@pixiv/three-vrm` in the React frontend.
- Created `frontend/src/components/AvatarCanvas.jsx` to render Ready Player Me (`.glb`) and VRoid Studio (`.vrm`) 3D models with lights, shadow, and orbit controls.
- Coded procedural real-time idle breathing and swaying animations in `AvatarCanvas.jsx` using bone manipulation.
- Integrated the 3D avatar canvas in `frontend/src/App.jsx` in a responsive split-screen layout with unique model URLs for each guide character (Siti, Budi, Aditya).
- Implemented **Stage 3 (Multimedia & Real-Time Voice Control)**: integrated HTML5 `MediaRecorder` API to record user voice messages, featuring an animated waveform recording UI.
- Integrated Web Speech Synthesis API (`id-ID`) for Sandbox Mode and HTML5 `Audio` playback for Live Mode, dynamically triggering the `isSpeaking` state.
- Coded procedural mouth lip-sync animations that animate both GLB morph targets (`mouthOpen`/`jawOpen`) and VRM blendshapes (`aa`/`A`) when the guide is speaking.
- Implemented multimodal file uploads with a floating image/video preview bar.
- Implemented **Stage 4 (Interactive Destination & Maps Widget)**: created `frontend/src/components/TravelWidgets.jsx` to render custom widgets.
- Coded `WeatherWidget` to show dynamic weather conditions based on destination keywords.
- Coded `MapWidget` to embed interactive Google Maps in a dark-themed container.
- Coded `ItineraryWidget` to display a vertical timeline of tourist schedules.
- Integrated all widgets dynamically inside the assistant's message bubble rendering in `App.jsx`.
