# IndiChessApplication

**IndiChessApplication** is a full-stack, real-time multiplayer chess platform designed to provide a seamless and interactive chess experience. Built with a robust **Spring Boot** backend and a dynamic **React** frontend, it leverages **WebSockets** for real-time game updates and includes secure authentication via **OAuth2** and **JWT**.

---

## 🚀 Features

### Authentication & Security
- **Secure Access**: JWT (JSON Web Token) based authentication for stateless and secure API interactions.
- **OAuth2 Integration**: One-click sign-in with **Google** (and ready for GitHub expansion).
- **Role-Based Access**: Granular permission control for different user types.
- **Protected Routes**: Frontend route guards ensure only authenticated users can access game areas.

### Gameplay & Real-time Interaction
- **Real-time Chess**: Experience lag-free chess matches powered by **WebSockets** and **StompJS**.
- **Live Matchmaking**: Find opponents instantly with an automated matchmaking queue service.
- **Move Validation**: Server-side move validation ensures fair play and game integrity.
- **Game State Management**: Real-time synchronization of board state, turn management, and game completion (Checkmate, Draw, Resignation).

### Dashboard & Analytics
- **User Profiles**: Track individual player stats and rating progression.
- **Game History**: Review past matches and outcomes (win/loss/draw).
- **Leaderboards**: (Planned) Compete for the top spot based on live ratings.

### User Interface
- **Modern Design**: A sleek, responsive UI built with **React 19** and **Tailwind CSS 4**.
- **Interactive Board**: Drag-and-drop piece movement with visual indicators for valid moves.
- **Responsive Layout**: meaningful experience across desktop and mobile devices.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: Spring Boot 4.0.1
- **Language**: Java 17
- **Security**: Spring Security, JWT, OAuth2 Client
- **Real-time**: Spring WebSocket, STOMP
- **Database**: MySQL 8.0
- **Build Tool**: Maven
- **ORM**: Spring Data JPA / Hibernate
- **Utilities**: Lombok

### Frontend
- **Framework**: React 19.x
- **Build Tool**: Vite 6.x
- **Styling**: Tailwind CSS 4.x
- **Real-time Client**: SockJS, StompJS
- **Routing**: React Router DOM 7.x
- **State Management**: React Hooks & Context API

### DevOps & Infrastructure
- **Containerization**: Docker, Docker Compose
- **Web Server**: Nginx (for serving frontend in production)

---

## 📋 Prerequisites

Before running the application, ensure you have the following installed:

- **Java JDK**: Version 17 or higher
- **Node.js**: Version 18 or higher (v20 recommended)
- **MySQL**: Version 8.0+
- **Docker** (Optional): For running the full stack with ease

---

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/vikasreddy148/IndiChessApplication
cd IndiChessApplication
```

### 2. Backend Setup
Navigate to the backend directory:
```bash
cd IndiChessBackend
```

**Configure Database:**
Update `src/main/resources/application.properties` or set environment variables:
```properties
spring.datasource.url=${DB_URL:jdbc:mysql://localhost:3306/indichessdb}
spring.datasource.username=${DB_USERNAME:root}
spring.datasource.password=${DB_PASSWORD:your_password}
```

**Configure Security:**
Set your JWT Secret and OAuth credentials (optional for local dev if defaults work):
```bash
export JWT_SECRET="your-very-secure-jwt-secret-key-at-least-32-chars"
export GOOGLE_OAUTH_CLIENT_ID="your-google-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="your-google-client-secret"
```

**Build and Run:**
```bash
# Using Maven Wrapper
./mvnw clean install
./mvnw spring-boot:run
```
The backend will start on `http://localhost:8080`.

### 3. Frontend Setup
Navigate to the frontend directory:
```bash
cd ../Indichessfrontend
```

**Install Dependencies:**
```bash
npm install
```

**Run Development Server:**
```bash
npm run dev
```
The frontend will be available at `http://localhost:5173`.

---

## 🐳 Docker Support

You can run the entire application stack (Frontend, Backend, and MySQL) using Docker Compose.

### Quick Start
1. Ensure Docker Desktop is running.
2. From the root directory:
   ```bash
   docker-compose up --build -d
   ```

### Access Points
- **Frontend**: [http://localhost:3000](http://localhost:3000) (as mapped in docker-compose)
- **Backend API**: `http://localhost:8080`
- **Database**: `localhost:3307`

### Stop Containers
```bash
docker-compose down
```

---

## 🔌 API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/api/auth/signup` | Register a new user |
| **POST** | `/api/auth/login` | Login and receive JWT |
| **GET** | `/api/user/profile` | Get current user details |
| **POST** | `/api/game/matchmake` | Join the matchmaking queue |
| **WS** | `/ws-indichess` | WebSocket endpoint for game events |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👤 Author
**Vikas Reddy**

## 📄 License
This project is open sourced under the MIT License.
