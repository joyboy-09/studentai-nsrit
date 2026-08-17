"""
StudentAI — FastAPI Backend
Main application with all API routes for authentication, document management,
AI quiz generation, flashcards, chat, math solving, and task assignment.
"""

import os
import shutil
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from database import get_db, init_db
from models import User, Document, Quiz, Flashcard, ChatMessage, Task
from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)
from file_parser import extract_text, get_file_type
from ai_engine import (
    process_document,
    generate_quiz,
    generate_flashcards,
    chat_with_document,
    chat_with_document_and_text,
    solve_math,
    generate_tasks,
    answer_topic_question,
    is_api_key_configured,
)

# ─── App Setup ───────────────────────────────────────────────────────────────
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Ensure default user exists for local auth mode
    from auth import ensure_default_user
    db = next(get_db())
    ensure_default_user(db)
    db.close()
    print("🚀 StudentAI API started!")
    yield

app = FastAPI(
    title="StudentAI API",
    description="AI-powered learning platform backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── Pydantic Schemas ───────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: str
    full_name: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class ChatRequest(BaseModel):
    message: str
    document_id: int


class MathRequest(BaseModel):
    problem: str


class TopicQuestionRequest(BaseModel):
    topic: str
    question: str


class QuizSubmitRequest(BaseModel):
    quiz_id: int
    answers: List[int]


class TaskUpdateRequest(BaseModel):
    is_completed: bool


# ─── Response Schemas ────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    avatar_url: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# ═══════════════════════════════════════════════════════════════════════════════
#  AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user account."""
    # Check if username or email already exists
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate password strength
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Create user
    user = User(
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        hashed_password=get_password_hash(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Generate token
    token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login with username and password."""
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse.model_validate(current_user)


# ═══════════════════════════════════════════════════════════════════════════════
#  DOCUMENT ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload and process a document (PDF, PPT, DOCX, TXT)."""
    # Validate file type
    file_type = get_file_type(file.filename or "")
    if file_type not in ["pdf", "pptx", "ppt", "docx", "doc", "txt"]:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, PPT, DOCX, or TXT.")

    # Save file to disk
    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{file.filename}")
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Extract text
    text = extract_text(file_path, file_type)
    if not text.strip():
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="Could not extract text from this file.")

    # Create document record
    doc = Document(
        title=os.path.splitext(file.filename or "Document")[0],
        filename=file.filename or "unknown",
        file_type=file_type,
        file_size=len(content),
        content_text=text,
        user_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Process document: chunk and store in ChromaDB
    try:
        chunk_count = process_document(doc.id, text)
        doc.chunk_count = chunk_count
        doc.is_processed = True
        db.commit()
    except Exception as e:
        print(f"Warning: Vector processing failed: {e}")
        doc.is_processed = True  # Still mark as processed; AI can use raw text
        db.commit()

    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "chunk_count": doc.chunk_count,
        "is_processed": doc.is_processed,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "text_preview": text[:500] + "..." if len(text) > 500 else text,
    }


@app.get("/api/documents")
async def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all documents for the current user."""
    docs = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.uploaded_at.desc()).all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "filename": d.filename,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "chunk_count": d.chunk_count,
            "is_processed": d.is_processed,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]


@app.get("/api/documents/{doc_id}")
async def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific document with its content."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "content_text": doc.content_text,
        "chunk_count": doc.chunk_count,
        "is_processed": doc.is_processed,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
    }


@app.delete("/api/documents/{doc_id}")
async def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a document and all associated data."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete the file from disk
    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{doc.filename}")
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(doc)
    db.commit()

    return {"message": "Document deleted successfully"}


# ═══════════════════════════════════════════════════════════════════════════════
#  QUIZ ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/documents/{doc_id}/generate-quiz")
async def generate_quiz_route(
    doc_id: int,
    num_questions: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a quiz from a document using AI."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Generate quiz using AI
    try:
        quiz_data = generate_quiz(doc.id, doc.content_text, num_questions)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Save quiz to database
    quiz = Quiz(
        title=quiz_data.get("title", f"Quiz for {doc.title}"),
        questions=quiz_data.get("questions", []),
        total_questions=len(quiz_data.get("questions", [])),
        document_id=doc.id,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    return {
        "id": quiz.id,
        "title": quiz.title,
        "questions": quiz.questions,
        "total_questions": quiz.total_questions,
        "created_at": quiz.created_at.isoformat() if quiz.created_at else None,
    }


@app.get("/api/documents/{doc_id}/quizzes")
async def list_quizzes(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all quizzes for a document."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    quizzes = db.query(Quiz).filter(Quiz.document_id == doc_id).order_by(Quiz.created_at.desc()).all()
    return [
        {
            "id": q.id,
            "title": q.title,
            "total_questions": q.total_questions,
            "score": q.score,
            "created_at": q.created_at.isoformat() if q.created_at else None,
            "completed_at": q.completed_at.isoformat() if q.completed_at else None,
        }
        for q in quizzes
    ]


@app.get("/api/quizzes/{quiz_id}")
async def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific quiz with all questions."""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Verify ownership
    doc = db.query(Document).filter(Document.id == quiz.document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return {
        "id": quiz.id,
        "title": quiz.title,
        "questions": quiz.questions,
        "total_questions": quiz.total_questions,
        "score": quiz.score,
        "user_answers": quiz.user_answers,
        "created_at": quiz.created_at.isoformat() if quiz.created_at else None,
    }


@app.post("/api/quizzes/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: int,
    req: QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit quiz answers and get score."""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Calculate score
    questions = quiz.questions or []
    correct = 0
    total = len(questions)
    results = []

    for i, q in enumerate(questions):
        user_answer = req.answers[i] if i < len(req.answers) else -1
        is_correct = user_answer == q.get("correct_answer", -1)
        if is_correct:
            correct += 1
        results.append({
            "question_id": q.get("id", i + 1),
            "user_answer": user_answer,
            "correct_answer": q.get("correct_answer", 0),
            "is_correct": is_correct,
            "explanation": q.get("explanation", ""),
        })

    score = (correct / total * 100) if total > 0 else 0

    # Update quiz record
    quiz.score = score
    quiz.user_answers = req.answers
    quiz.completed_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "score": score,
        "correct": correct,
        "total": total,
        "results": results,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  FLASHCARD ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/documents/{doc_id}/generate-flashcards")
async def generate_flashcards_route(
    doc_id: int,
    num_cards: int = 15,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate flashcards from a document using AI."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Generate flashcards using AI
    try:
        cards_data = generate_flashcards(doc.id, doc.content_text, num_cards)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Save flashcards to database
    created_cards = []
    for card in cards_data:
        fc = Flashcard(
            front=card.get("front", ""),
            back=card.get("back", ""),
            difficulty=card.get("difficulty", "medium"),
            document_id=doc.id,
        )
        db.add(fc)
        created_cards.append(fc)

    db.commit()

    return [
        {
            "id": fc.id,
            "front": fc.front,
            "back": fc.back,
            "difficulty": fc.difficulty,
            "is_mastered": fc.is_mastered,
            "review_count": fc.review_count,
        }
        for fc in created_cards
    ]


@app.get("/api/documents/{doc_id}/flashcards")
async def list_flashcards(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all flashcards for a document."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    cards = db.query(Flashcard).filter(Flashcard.document_id == doc_id).all()
    return [
        {
            "id": c.id,
            "front": c.front,
            "back": c.back,
            "difficulty": c.difficulty,
            "is_mastered": c.is_mastered,
            "review_count": c.review_count,
        }
        for c in cards
    ]


@app.patch("/api/flashcards/{card_id}")
async def update_flashcard(
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle mastered status and increment review count for a flashcard."""
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    card.is_mastered = not card.is_mastered
    card.review_count += 1
    db.commit()

    return {
        "id": card.id,
        "is_mastered": card.is_mastered,
        "review_count": card.review_count,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  CHAT ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/chat")
async def chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chat with AI about a document (RAG-powered)."""
    doc = db.query(Document).filter(
        Document.id == req.document_id,
        Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Get chat history
    history = db.query(ChatMessage).filter(
        ChatMessage.document_id == req.document_id,
        ChatMessage.user_id == current_user.id,
    ).order_by(ChatMessage.created_at.asc()).all()

    chat_history = [{"role": m.role, "content": m.content} for m in history]

    # Get AI response
    try:
        ai_response = chat_with_document_and_text(doc.id, req.message, doc.content_text, chat_history)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Save messages to database
    user_msg = ChatMessage(
        role="user",
        content=req.message,
        user_id=current_user.id,
        document_id=req.document_id,
    )
    assistant_msg = ChatMessage(
        role="assistant",
        content=ai_response,
        user_id=current_user.id,
        document_id=req.document_id,
    )
    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()

    return {
        "response": ai_response,
        "message_id": assistant_msg.id,
    }


@app.get("/api/documents/{doc_id}/chat-history")
async def get_chat_history(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get chat history for a document."""
    messages = db.query(ChatMessage).filter(
        ChatMessage.document_id == doc_id,
        ChatMessage.user_id == current_user.id,
    ).order_by(ChatMessage.created_at.asc()).all()

    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


# ═══════════════════════════════════════════════════════════════════════════════
#  MATH & TOPIC ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/math/solve")
async def solve_math_route(
    req: MathRequest,
    current_user: User = Depends(get_current_user),
):
    """Solve a math problem with step-by-step explanation."""
    try:
        result = solve_math(req.problem)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"solution": result}


@app.post("/api/topic/ask")
async def ask_topic(
    req: TopicQuestionRequest,
    current_user: User = Depends(get_current_user),
):
    """Ask a question about any topic."""
    try:
        answer = answer_topic_question(req.topic, req.question)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"answer": answer}


# ═══════════════════════════════════════════════════════════════════════════════
#  TASK ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/documents/{doc_id}/generate-tasks")
async def generate_tasks_route(
    doc_id: int,
    num_tasks: int = 8,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate study tasks from a document using AI."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        tasks_data = generate_tasks(doc.id, doc.content_text, num_tasks)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    created_tasks = []
    for t in tasks_data:
        task = Task(
            title=t.get("title", "Study Task"),
            description=t.get("description", ""),
            task_type=t.get("task_type", "reading"),
            difficulty=t.get("difficulty", "medium"),
            estimated_minutes=t.get("estimated_minutes", 15),
            document_id=doc.id,
        )
        db.add(task)
        created_tasks.append(task)

    db.commit()

    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "task_type": t.task_type,
            "difficulty": t.difficulty,
            "estimated_minutes": t.estimated_minutes,
            "is_completed": t.is_completed,
        }
        for t in created_tasks
    ]


@app.get("/api/documents/{doc_id}/tasks")
async def list_tasks(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all tasks for a document."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    tasks = db.query(Task).filter(Task.document_id == doc_id).all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "task_type": t.task_type,
            "difficulty": t.difficulty,
            "estimated_minutes": t.estimated_minutes,
            "is_completed": t.is_completed,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        }
        for t in tasks
    ]


@app.patch("/api/tasks/{task_id}")
async def update_task(
    task_id: int,
    req: TaskUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update task completion status."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.is_completed = req.is_completed
    if req.is_completed:
        task.completed_at = datetime.now(timezone.utc)
    else:
        task.completed_at = None
    db.commit()

    return {
        "id": task.id,
        "is_completed": task.is_completed,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD STATS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/dashboard/stats")
async def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get dashboard statistics for the current user."""
    total_docs = db.query(Document).filter(Document.user_id == current_user.id).count()
    total_quizzes = (
        db.query(Quiz)
        .join(Document)
        .filter(Document.user_id == current_user.id)
        .count()
    )
    completed_quizzes = (
        db.query(Quiz)
        .join(Document)
        .filter(Document.user_id == current_user.id, Quiz.score.isnot(None))
        .count()
    )
    total_flashcards = (
        db.query(Flashcard)
        .join(Document)
        .filter(Document.user_id == current_user.id)
        .count()
    )
    mastered_flashcards = (
        db.query(Flashcard)
        .join(Document)
        .filter(Document.user_id == current_user.id, Flashcard.is_mastered == True)
        .count()
    )
    total_tasks = (
        db.query(Task)
        .join(Document)
        .filter(Document.user_id == current_user.id)
        .count()
    )
    completed_tasks = (
        db.query(Task)
        .join(Document)
        .filter(Document.user_id == current_user.id, Task.is_completed == True)
        .count()
    )

    # Average quiz score
    quiz_scores = (
        db.query(Quiz.score)
        .join(Document)
        .filter(Document.user_id == current_user.id, Quiz.score.isnot(None))
        .all()
    )
    avg_score = sum(s[0] for s in quiz_scores) / len(quiz_scores) if quiz_scores else 0

    return {
        "total_documents": total_docs,
        "total_quizzes": total_quizzes,
        "completed_quizzes": completed_quizzes,
        "average_score": round(avg_score, 1),
        "total_flashcards": total_flashcards,
        "mastered_flashcards": mastered_flashcards,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
    }


# ─── Health Check ────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "StudentAI API",
        "version": "1.0.0",
        "ai_configured": is_api_key_configured(),
    }


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
