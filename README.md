# Nexus Secure Chat

A modern, privacy-focused messaging platform with end-to-end encryption, real-time collaboration, and AI-powered security analysis.

---

## Overview

Nexus Secure Chat is a full-stack messaging application built with React, Node.js, Socket.IO, and PostgreSQL. It combines strong client-side encryption with advanced features including live code collaboration, a shared whiteboard, WebRTC voice and video calls, and an AI-driven scam detection engine.

---

## Features

- **End-to-End Encryption** — All messages are encrypted client-side using AES (CryptoJS) with a per-room key derived from a master salt.
- **AI Spam & Scam Detection** — Real-time analysis of incoming messages flags phishing attempts, suspicious links, and crypto scams.
- **Trust Score Engine** — Each conversation builds a trust level based on interaction history (New Contact → Established → Trusted → Highly Trusted), displayed as a colour-coded shield.
- **Read Receipts** — Single grey tick (sent), double grey ticks (delivered), double blue ticks (read).
- **File Sharing** — Upload images and documents; image previews and downloadable links for other file types.
- **Shared Whiteboard** — Collaborative drawing with colour selection, synced in real time via WebSockets.
- **Live Code Editor** — Collaborative code editing powered by Monaco Editor (VS Code's engine) with Operational Transformation (OT).
- **WebRTC Calls** — Audio and video calls with STUN server support, call notifications, and media controls.
- **Online Presence** — Indicators show which contacts are currently online.
- **User Verification** — Verified badges for trusted contacts (admin-set in the database).
- **Message Deletion** — Delete messages for yourself or for everyone (author only).

---

## Tech Stack

| Area          | Technology                                                                        |
| ------------- | --------------------------------------------------------------------------------- |
| Frontend      | React (Vite), Tailwind CSS, Socket.IO-client, CryptoJS, Monaco Editor, Axios     |
| Backend       | Node.js, Express, Socket.IO, PostgreSQL (node-postgres), Multer                  |
| Real-time     | WebSockets (Socket.IO) for messaging, typing, and whiteboard; WebRTC for calls   |
| Security      | AES encryption (CryptoJS), HMAC key derivation, JWT authentication               |
| Database      | PostgreSQL — `users` and `messages` tables                                        |
| Deployment    | Vercel (frontend), Render (backend), Neon or Render Postgres (database)           |

---

## Getting Started

### Prerequisites

- Node.js v16 or higher
- npm or yarn
- PostgreSQL (local or cloud, e.g., Neon)

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/AbbasZain12/nexus-secure-chat.git
cd nexus-secure-chat
```

**2. Backend setup**

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory:

```env
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/nexus
JWT_SECRET=your_super_secret_key
CLIENT_URL=http://localhost:5173
```

> For production, replace `DATABASE_URL` with your cloud PostgreSQL URI and set `CLIENT_URL` to your frontend domain.

**3. Database schema**

Run the following SQL against your PostgreSQL database:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100),
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(255) NOT NULL,
  author VARCHAR(100) NOT NULL,
  message TEXT,
  time VARCHAR(10),
  status VARCHAR(20) DEFAULT 'sent',
  is_deleted BOOLEAN DEFAULT false,
  deleted_for TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**4. Frontend setup**

```bash
cd ../client
npm install
```

Create a `.env` file in the `client` directory:

```env
VITE_API_URL=http://localhost:5000
```

> In production, set `VITE_API_URL` to your deployed backend URL (e.g., `https://your-backend.onrender.com`).

### Running Locally

Start the backend:

```bash
cd server
npm start
# or with auto-restart: npm run dev
```

Start the frontend:

```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Project Structure

```
nexus-chat/
├── client/                         # React frontend (Vite)
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   └── ChatDashboard.jsx   # Main chat UI
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css               # Tailwind entry
│   ├── package.json
│   └── vite.config.js
│
└── server/                         # Node.js backend
    ├── config/
    │   └── db.js                   # PostgreSQL pool
    ├── routes/
    │   └── authRoutes.js           # Authentication endpoints
    ├── uploads/                    # Temporary file storage
    ├── .env
    ├── package.json
    └── server.js                   # Express + Socket.IO entry point
```

---

## Deployment

This project uses a hybrid deployment model to preserve full real-time functionality.

| Layer    | Provider          | Notes                                      |
| -------- | ----------------- | ------------------------------------------ |
| Frontend | Vercel            | Set root directory to `client`             |
| Backend  | Render            | Required for WebSocket support             |
| Database | Neon / Render Postgres | Run the schema SQL once after provisioning |

### Vercel (Frontend)

1. Import the repository into Vercel.
2. Set the root directory to `client`.
3. Add the environment variable: `VITE_API_URL` = your Render backend URL.
4. Deploy.

### Render (Backend)

1. Create a new Web Service and connect your GitHub repository.
2. Set the root directory to `server`.
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL` (your Vercel frontend URL).

> **Note:** File uploads are stored locally in `server/uploads`. On Render, the filesystem is ephemeral and uploaded files will not persist across deploys. For production use, integrate cloud storage such as AWS S3, Cloudinary, or Vercel Blob.

---

## Contributing

Contributions are welcome. Please follow the steps below:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Commit your changes: `git commit -m 'Add your feature'`.
4. Push to the branch: `git push origin feat/your-feature`.
5. Open a Pull Request.

For major changes, please open an issue first to discuss the proposed update.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgements

- [Vite](https://vitejs.dev) — fast frontend tooling
- [Tailwind CSS](https://tailwindcss.com) — utility-first CSS framework
- [Socket.IO](https://socket.io) — real-time engine
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — code editor component
- [CryptoJS](https://cryptojs.gitbook.io/docs/) — encryption library
- [Render](https://render.com) — backend hosting
- [Vercel](https://vercel.com) — frontend deployment
