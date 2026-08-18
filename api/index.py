import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import shutil
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

app_error = None
try:
    from pydantic import BaseModel
    from database import init_db
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
except Exception as e:
    import traceback
    app_error = traceback.format_exc()

app = FastAPI(
    title="StudentAI API",
    description="AI-powered learning platform backend",
    version="1.0.0",
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
if os.environ.get("VERCEL") == "1":
    UPLOAD_DIR = "/tmp/uploads"
else:
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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# ═══════════════════════════════════════════════════════════════════════════════
#  AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    """Register a new user account."""
    # Check if username or email already exists
    if User.get_by_username(req.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    if User.get_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate password strength
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Create user
    user = User.create(
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        hashed_password=get_password_hash(req.password),
    )

    # Generate token
    token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
        ),
    )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """Login with username and password."""
    user = User.get_by_username(req.username)
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
        ),
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  DOCUMENT ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
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

    # Create document record in Firebase
    doc = Document.create(
        title=os.path.splitext(file.filename or "Document")[0],
        filename=file.filename or "unknown",
        file_type=file_type,
        file_size=len(content),
        content_text=text,
        user_id=current_user.id,
    )

    # Process document: chunk and store in ChromaDB
    try:
        chunk_count = process_document(doc.id, text)
        doc.update(chunk_count=chunk_count, is_processed=True)
    except Exception as e:
        print(f"Warning: Vector processing failed: {e}")
        doc.update(is_processed=True)  # Still mark as processed; AI can use raw text

    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "chunk_count": doc.chunk_count,
        "is_processed": doc.is_processed,
        "uploaded_at": doc.uploaded_at,
        "text_preview": text[:500] + "..." if len(text) > 500 else text,
    }


@app.get("/api/documents")
async def list_documents(
    current_user: User = Depends(get_current_user),
):
    """List all documents for the current user."""
    docs = Document.list_by_user(current_user.id)
    return [
        {
            "id": d.id,
            "title": d.title,
            "filename": d.filename,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "chunk_count": d.chunk_count,
            "is_processed": d.is_processed,
            "uploaded_at": d.uploaded_at,
        }
        for d in docs
    ]


@app.get("/api/documents/{doc_id}")
async def get_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
):
    """Get a specific document with its content."""
    doc = Document.get_by_id_and_user(doc_id, current_user.id)
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
        "uploaded_at": doc.uploaded_at,
    }


@app.delete("/api/documents/{doc_id}")
async def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
):
    """Delete a document and all associated data."""
    doc = Document.get_by_id_and_user(doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete the file from disk
    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{doc.filename}")
    if os.path.exists(file_path):
        os.remove(file_path)

    doc.delete()

    return {"message": "Document deleted successfully"}


# ═══════════════════════════════════════════════════════════════════════════════
#  QUIZ ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/documents/{doc_id}/generate-quiz")
async def generate_quiz_route(
    doc_id: int,
    num_questions: int = 10,
    current_user: User = Depends(get_current_user),
):
    """Generate a quiz from a document using AI."""
    doc = Document.get_by_id_and_user(doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Generate quiz using AI
    try:
        quiz_data = generate_quiz(doc.id, doc.content_text, num_questions)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Save quiz to Firebase
    quiz = Quiz.create(
        title=quiz_data.get("title", f"Quiz for {doc.title}"),
        questions=quiz_data.get("questions", []),
        total_questions=len(quiz_data.get("questions", [])),
        document_id=doc.id,
    )

    return {
        "id": quiz.id,
        "title": quiz.title,
        "questions": quiz.questions,
        "total_questions": quiz.total_questions,
        "created_at": quiz.created_at,
    }


@app.get("/api/documents/{doc_id}/quizzes")
async def list_quizzes(
    doc_id: int,
    current_user: User = Depends(get_current_user),
):
    """List all quizzes for a document."""
    doc = Document.get_by_id_and_user(doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    quizzes = Quiz.list_by_document(doc_id)
    return [
        {
            "id": q.id,
            "title": q.title,
            "total_questions": q.total_questions,
            "score": q.score,
            "created_at": q.created_at,
            "completed_at": q.completed_at,
        }
        for q in quizzes
    ]


@app.get("/api/quizzes/{quiz_id}")
async def get_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
):
    """Get a specific quiz with all questions."""
    quiz = Quiz.get_by_id(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Verify ownership
    doc = Document.get_by_id_and_user(quiz.document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return {
        "id": quiz.id,
        "title": quiz.title,
        "questions": quiz.questions,
        "total_questions": quiz.total_questions,
        "score": quiz.score,
        "user_answers": quiz.user_answers,
        "created_at": quiz.created_at,
    }


@app.post("/api/quizzes/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: int,
    req: QuizSubmitRequest,
    current_user: User = Depends(get_current_user),
):
    """Submit quiz answers and get score."""
    quiz = Quiz.get_by_id(quiz_id)
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

    # Update quiz record in Firebase
    quiz.update(
        score=score,
        user_answers=req.answers,
        completed_at=datetime.now(timezone.utc).isoformat(),
    )

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
    current_user: User = Depends(get_current_user),
):
    """Generate flashcards from a document using AI."""
    doc = Document.get_by_id_and_user(doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Generate flashcards using AI
    try:
        cards_data = generate_flashcards(doc.id, doc.content_text, num_cards)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Save flashcards to Firebase
    created_cards = []
    for card in cards_data:
        fc = Flashcard.create(
            front=card.get("front", ""),
            back=card.get("back", ""),
            difficulty=card.get("difficulty", "medium"),
            document_id=doc.id,
        )
        created_cards.append(fc)

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
    current_user: User = Depends(get_current_user),
):
    """List all flashcards for a document."""
    doc = Document.get_by_id_and_user(doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    cards = Flashcard.list_by_document(doc_id)
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
    current_user: User = Depends(get_current_user),
):
    """Toggle mastered status and increment review count for a flashcard."""
    card = Flashcard.get_by_id(card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    card.update(
        is_mastered=not card.is_mastered,
        review_count=card.review_count + 1,
    )

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
    current_user: User = Depends(get_current_user),
):
    """Chat with AI about a document (RAG-powered)."""
    doc = Document.get_by_id_and_user(req.document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Get chat history
    history = ChatMessage.list_by_document_and_user(req.document_id, current_user.id)
    chat_history = [{"role": m.role, "content": m.content} for m in history]

    # Get AI response
    try:
        ai_response = chat_with_document_and_text(doc.id, req.message, doc.content_text, chat_history)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Save messages to Firebase
    user_msg = ChatMessage.create(
        role="user",
        content=req.message,
        user_id=current_user.id,
        document_id=req.document_id,
    )
    assistant_msg = ChatMessage.create(
        role="assistant",
        content=ai_response,
        user_id=current_user.id,
        document_id=req.document_id,
    )

    return {
        "response": ai_response,
        "message_id": assistant_msg.id,
    }


@app.get("/api/documents/{doc_id}/chat-history")
async def get_chat_history(
    doc_id: int,
    current_user: User = Depends(get_current_user),
):
    """Get chat history for a document."""
    messages = ChatMessage.list_by_document_and_user(doc_id, current_user.id)

    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at,
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
    current_user: User = Depends(get_current_user),
):
    """Generate study tasks from a document using AI."""
    doc = Document.get_by_id_and_user(doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        tasks_data = generate_tasks(doc.id, doc.content_text, num_tasks)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    created_tasks = []
    for t in tasks_data:
        task = Task.create(
            title=t.get("title", "Study Task"),
            description=t.get("description", ""),
            task_type=t.get("task_type", "reading"),
            difficulty=t.get("difficulty", "medium"),
            estimated_minutes=t.get("estimated_minutes", 15),
            document_id=doc.id,
        )
        created_tasks.append(task)

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
    current_user: User = Depends(get_current_user),
):
    """List all tasks for a document."""
    doc = Document.get_by_id_and_user(doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    tasks = Task.list_by_document(doc_id)
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "task_type": t.task_type,
            "difficulty": t.difficulty,
            "estimated_minutes": t.estimated_minutes,
            "is_completed": t.is_completed,
            "completed_at": t.completed_at,
        }
        for t in tasks
    ]


@app.patch("/api/tasks/{task_id}")
async def update_task(
    task_id: int,
    req: TaskUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    """Update task completion status."""
    task = Task.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    completed_at = datetime.now(timezone.utc).isoformat() if req.is_completed else None
    task.update(is_completed=req.is_completed, completed_at=completed_at)

    return {
        "id": task.id,
        "is_completed": task.is_completed,
        "completed_at": task.completed_at,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD STATS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/dashboard/stats")
async def dashboard_stats(
    current_user: User = Depends(get_current_user),
):
    """Get dashboard statistics for the current user."""
    docs = Document.list_by_user(current_user.id)
    total_docs = len(docs)

    quizzes = Quiz.list_by_user(current_user.id)
    total_quizzes = len(quizzes)
    completed_quizzes = len([q for q in quizzes if q.score is not None])

    flashcards = Flashcard.list_by_user(current_user.id)
    total_flashcards = len(flashcards)
    mastered_flashcards = len([f for f in flashcards if f.is_mastered])

    tasks = Task.list_by_user(current_user.id)
    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.is_completed])

    # Average quiz score
    scored = [q.score for q in quizzes if q.score is not None]
    avg_score = sum(scored) / len(scored) if scored else 0

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
def health_check():
    if app_error:
        return {"status": "error", "error": app_error}
    return {"status": "ok", "message": "StudentAI backend is running with Firebase Realtime Database"}

@app.get("/api")
def api_root():
    if app_error:
        return {"status": "error", "error": app_error}
    return {"message": "Welcome to StudentAI API", "docs_url": "/docs"}


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("index:app", host="0.0.0.0", port=8000, reload=True)
