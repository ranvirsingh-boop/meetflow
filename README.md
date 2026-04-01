# 🎥 MeetFlow

> Video conferencing app — built by two 2nd year CS students.

Real-time video meetings with live chat, reactions, captions, screen share indicator, and scheduled meetings.

---

## 📁 Project Structure

```
meetflow/
├── backend/                  ← Node.js + Express + Socket.io
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/meetings.js
│   │   └── socket/socketHandler.js
│   ├── .env.example
│   └── package.json
│
└── frontend/                 ← React.js
    ├── public/index.html
    ├── src/
    │   ├── App.js
    │   ├── index.js
    │   ├── index.css
    │   ├── context/MeetingContext.js
    │   ├── pages/
    │   │   ├── Home.js + Home.module.css
    │   │   └── Call.js + Call.module.css
    │   └── components/
    │       ├── Sidebar.js + Sidebar.module.css
    │       ├── ReactionsPanel.js + ReactionsPanel.module.css
    │       ├── Toast.js + Toast.module.css
    │       ├── ScheduleModal.js
    │       ├── JoinModal.js
    │       └── Modal.module.css
    └── package.json
```

---

## 🚀 Run Locally

### Backend (Terminal 1)
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend (Terminal 2)
```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000

---

## ☁️ Deploy to GitHub + Render + Vercel

See full deployment instructions below.

---

## 🛠 Tech Stack

- **Frontend:** React 18, React Router, Socket.io Client, CSS Modules
- **Backend:** Node.js, Express, Socket.io
- **Deploy:** Render (backend) + Vercel (frontend)
