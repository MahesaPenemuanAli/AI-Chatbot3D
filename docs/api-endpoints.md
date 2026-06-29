# AI Chatbot API Endpoints

This document specifies the REST API endpoints provided by the Laravel 13 backend. All API requests must include the `Accept: application/json` header. Protected endpoints require Bearer Token authentication via Laravel Sanctum.

---

## Authentication Endpoints

### 1. User Registration
* **Endpoint**: `POST /api/register`
* **Authentication**: None
* **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "password_confirmation": "password123"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2026-06-29T12:00:00.000000Z"
    },
    "token": "1|laravel_sanctum_token_here"
  }
  ```

### 2. User Login
* **Endpoint**: `POST /api/login`
* **Authentication**: None
* **Request Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "2|laravel_sanctum_token_here"
  }
  ```

### 3. User Logout
* **Endpoint**: `POST /api/logout`
* **Authentication**: Bearer Token
* **Response (200 OK)**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

---

## Chat Session Endpoints

### 1. List Chat Sessions
* **Endpoint**: `GET /api/chat/sessions`
* **Authentication**: Bearer Token
* **Response (200 OK)**:
  ```json
  [
    {
      "id": "uuid-1234-5678",
      "title": "Introduction to Laravel",
      "created_at": "2026-06-29T12:15:00.000000Z",
      "updated_at": "2026-06-29T12:30:00.000000Z"
    }
  ]
  ```

### 2. Create Chat Session
* **Endpoint**: `POST /api/chat/sessions`
* **Authentication**: Bearer Token
* **Request Body**:
  ```json
  {
    "title": "New Chat Session" // Optional, defaults to "New Chat"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "id": "uuid-1234-5678",
    "title": "New Chat Session",
    "created_at": "2026-06-29T12:45:00.000000Z"
  }
  ```

### 3. Delete Chat Session
* **Endpoint**: `DELETE /api/chat/sessions/{id}`
* **Authentication**: Bearer Token
* **Response (200 OK)**:
  ```json
  {
    "message": "Session deleted successfully"
  }
  ```

---

## Message Endpoints

### 1. Get Session Messages
* **Endpoint**: `GET /api/chat/sessions/{id}/messages`
* **Authentication**: Bearer Token
* **Response (200 OK)**:
  ```json
  [
    {
      "id": 1,
      "role": "user",
      "content": "What is Laravel?",
      "created_at": "2026-06-29T12:15:10.000000Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "Laravel is a web application framework with expressive, elegant syntax...",
      "created_at": "2026-06-29T12:15:15.000000Z"
    }
  ]
  ```

### 2. Send Message (Chat with AI)
* **Endpoint**: `POST /api/chat/sessions/{id}/messages`
* **Authentication**: Bearer Token
* **Request Body**:
  ```json
  {
    "message": "Explain MVC pattern in Laravel"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "user_message": {
      "id": 3,
      "role": "user",
      "content": "Explain MVC pattern in Laravel",
      "created_at": "2026-06-29T12:20:00.000000Z"
    },
    "ai_message": {
      "id": 4,
      "role": "assistant",
      "content": "In Laravel, the Model-View-Controller (MVC) pattern is implemented as follows...",
      "created_at": "2026-06-29T12:20:05.000000Z"
    }
  }
  ```
