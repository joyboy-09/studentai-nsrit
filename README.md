# 🎓 StudentAI — AI-Powered Learning Platform

A full-stack web application where students upload study materials (PDF, PPT, Word) and AI generates quizzes, flashcards, study tasks, answers questions, and solves math problems.

![Tech Stack](https://img.shields.io/badge/Frontend-Next.js_14-000?style=flat-square&logo=next.js)
![Tech Stack](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)
![Tech Stack](https://img.shields.io/badge/AI-Google_Gemini-4285F4?style=flat-square&logo=google)
![Tech Stack](https://img.shields.io/badge/DB-SQLite-003B57?style=flat-square&logo=sqlite)

## ✨ Features

- 🔐 **Secure Authentication** — Register/Login with Name
- 📤 **File Upload** — PDF, PPT, Word, TXT with text extraction
- 🧠 **AI Quiz Generator** — Multiple-choice quizzes with scoring
- 🃏 **Smart Flashcards** — 3D flip cards with mastery tracking
- 💬 **AI Chat Tutor** — RAG-powered Q&A about your documents
- 🔢 **Math Solver** — Step-by-step math solutions
- ✅ **Study Tasks** — AI-assigned learning activities
- 🎯 **Topic Q&A** — Ask anything about any subject
- ✨ **Premium UI** — Dark theme, glassmorphism, Framer Motion animations

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** — [python.org](https://python.org)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Google Gemini API Key** (free) — [aistudio.google.com](https://aistudio.google.com)

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your Gemini API key
# Edit .env file and add your key:
# GEMINI_API_KEY=your_actual_key_here

# Start the backend
python main.py
# → Backend runs at http://localhost:8000
# → API docs at http://localhost:8000/docs
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# → Frontend runs at http://localhost:3000
```

### 3. Use the App

1. Open **http://localhost:3000** in your browser
2. Click **Get Started** → Register an account
3. Upload a PDF, PPT, or Word document
4. Click on the document to:
   - Generate AI quizzes
   - Create flashcards
   - Chat with AI about your material
   - Get study tasks
5. Use **Math Solver** or **Ask Any Topic** from the dashboard

## 🏗 Project Structure

```
StudentAI/
├── backend/
│   ├── main.py          # FastAPI app with all routes
│   ├── models.py        # SQLAlchemy ORM models
│   ├── database.py      # Database configuration
│   ├── auth.py          # JWT authentication
│   ├── ai_engine.py     # LangChain + Gemini + ChromaDB
│   ├── file_parser.py   # PDF/PPT/Word text extraction
│   ├── requirements.txt # Python dependencies
│   └── .env             # API keys (edit this!)
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── layout.tsx            # Root layout
│   │   │   ├── globals.css           # Design system
│   │   │   ├── login/page.tsx        # Login page
│   │   │   ├── register/page.tsx     # Registration page
│   │   │   └── dashboard/
│   │   │       ├── page.tsx          # Main dashboard
│   │   │       └── document/[id]/
│   │   │           └── page.tsx      # Doc detail (quiz/cards/chat/tasks)
│   │   └── lib/
│   │       └── api.ts                # API client
│   └── package.json
└── README.md
```

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/documents/upload` | Upload document |
| GET | `/api/documents` | List documents |
| POST | `/api/documents/{id}/generate-quiz` | Generate quiz |
| POST | `/api/documents/{id}/generate-flashcards` | Generate flashcards |
| POST | `/api/documents/{id}/generate-tasks` | Generate tasks |
| POST | `/api/chat` | Chat with document |
| POST | `/api/math/solve` | Solve math problem |
| POST | `/api/topic/ask` | Ask topic question |
| GET | `/api/dashboard/stats` | Get stats |

## 🛠 Tech Stack

### Backend
- **FastAPI** — Python web framework
- **LangChain** — AI orchestration
- **Google Gemini** — AI model (free tier)
- **ChromaDB** — Vector database (embedded)
- **SQLAlchemy** — ORM
- **SQLite** — Database
- **PyMuPDF / python-pptx / python-docx** — File parsing

### Frontend
- **Next.js 14** — React framework
- **Framer Motion** — Animations
- **Tailwind CSS** — Styling
- **Lucide React** — Icons
- **React Dropzone** — File upload
- **React Hot Toast** — Notifications

---

Built with ❤️ for students who want to learn smarter, not harder.
