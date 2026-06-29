# Advanced 3D Multimodal AI Chatbot Database Design

This document details the database schema and system architecture for an advanced, real-time multimodal AI Chatbot. The system supports:
- **Multimodal Inputs/Outputs**: Text, Audio (voice messages), Images, and Videos.
- **Real-Time Voice Chat**: Speech-to-Text (STT) transcription and Text-to-Speech (TTS) audio generation.
- **3D Avatar Integration**: Support for Ready Player Me (.glb) and VRoid Studio (.vrm) models, including emotional animations and lip-sync (viseme) metadata.

---

## 1. System Architecture Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User (React Frontend)
    participant Front3D as 3D Avatar Engine (Three.js/R3F)
    participant Laravel as Laravel 13 Backend
    participant DB as SQLite Database
    participant Gemini as Google Gemini API (Multimodal)
    participant TTS as TTS Service (ElevenLabs/OpenAI)

    User->>Laravel: Send Message (Text / Audio Recording / Image / Video)
    Note over Laravel: If Audio: Transcribe using Whisper/Gemini
    Laravel->>DB: Save User Message & Attachments
    Laravel->>Gemini: Send Conversation History + New Media
    Gemini-->>Laravel: Return AI Text + Emotional Cue (e.g., [happy])
    Laravel->>TTS: Generate Speech Audio from Text (optional)
    TTS-->>Laravel: Return Audio File (MP3/WAV)
    Note over Laravel: Generate Viseme/Lip-Sync data from Audio
    Laravel->>DB: Save AI Message (Text, Audio URL, Visemes, Expression)
    Laravel-->>User: Return JSON (Text, Audio URL, Visemes, Expression)
    User->>Front3D: Play Audio & Apply Visemes for Lip-Sync
    User->>Front3D: Trigger 3D Animation (e.g., Happy Animation)
```

---

## 2. Database Schema (Entity-Relationship Diagram)

```mermaid
erDiagram
    users ||--o| user_preferences : "has"
    users ||--o{ chat_sessions : "creates"
    avatars ||--o{ chat_sessions : "used in"
    avatars ||--o{ avatar_animations : "has"
    chat_sessions ||--o{ chat_messages : "contains"
    chat_messages ||--o{ message_attachments : "has"

    users {
        bigint id PK
        string name
        string email
        string password
        string avatar_url
        timestamps elapsed
    }

    user_preferences {
        bigint id PK
        bigint user_id FK
        string theme
        boolean enable_voice_output
        boolean enable_3d_avatar
        string preferred_voice_id
        string preferred_language
        timestamps elapsed
    }

    avatars {
        bigint id PK
        string name
        string description
        string model_url "ReadyPlayerMe GLB or VRoid VRM URL"
        string voice_id "TTS voice ID"
        string personality_prompt "System prompt for this character"
        timestamps elapsed
    }

    avatar_animations {
        bigint id PK
        bigint avatar_id FK
        string emotion "happy, sad, excited, thinking, neutral"
        string animation_url "FBX/GLTF animation path"
        boolean loop
    }

    chat_sessions {
        string id PK "UUID"
        bigint user_id FK
        bigint avatar_id FK
        string title
        timestamps elapsed
    }

    chat_messages {
        bigint id PK
        string chat_session_id FK
        string role "user, model, system"
        string message_type "text, audio, image, video, multimodal"
        text content "Text response or transcription"
        string audio_url "TTS or Voice recording path"
        integer duration "Audio duration in seconds"
        json metadata "Visemes, blendshapes, facial expressions, bounding boxes"
        timestamps elapsed
    }

    message_attachments {
        bigint id PK
        bigint chat_message_id FK
        string attachment_type "image, video, audio, document"
        string file_path
        string file_name
        string mime_type
        integer file_size
        timestamps elapsed
    }
```

---

## 3. Data Details & Advanced Fields

### `chat_messages.metadata` (JSON)
This field is critical for driving the 3D avatar on the frontend. It contains:
1. **`expression`**: Emotional cue parsed from the AI response (e.g. `happy`, `sad`, `thinking`, `surprised`).
2. **`visemes`**: Array of time-stamped mouth shape blendshapes (visemes) for lip-sync.
   ```json
   {
     "expression": "happy",
     "visemes": [
       {"time": 0, "viseme": "sil"},
       {"time": 100, "viseme": "PP"},
       {"time": 250, "viseme": "FF"},
       {"time": 400, "viseme": "O"}
     ]
   }
   ```

### `avatars.model_url`
Contains the absolute URL of the 3D model:
- **Ready Player Me**: Directly loads the `.glb` file using Three.js GLTFLoader.
- **VRoid Studio**: Loads the `.vrm` file using `@pixiv/three-vrm`.

### `message_attachments.file_path`
Stores files uploaded by the user (images of herbal leaves, videos of symptoms, voice recordings) in Laravel's local/S3 storage. These are sent as multimodal parts to the Gemini API.
