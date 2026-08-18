"""
Firebase Realtime Database models for StudentAI.
Each model provides CRUD helpers that read/write to Firebase RTDB.
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from database import get_db_ref, get_next_id


def _now_iso() -> str:
    """Return current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat()


def _iter_collection(data: Any):
    """
    Safely iterate over collection data from Firebase Realtime Database.
    Firebase returns a list when keys are dense 0-indexed integers, and a dict otherwise.
    Yields (int_id, item_dict) for valid non-empty items.
    """
    if not data:
        return
    if isinstance(data, list):
        for idx, item in enumerate(data):
            if item is not None and isinstance(item, dict):
                yield idx, item
    elif isinstance(data, dict):
        for key, item in data.items():
            if item is not None and isinstance(item, dict):
                try:
                    yield int(key), item
                except (ValueError, TypeError):
                    pass


# ═══════════════════════════════════════════════════════════════════════════════
#  USER
# ═══════════════════════════════════════════════════════════════════════════════


class User:
    """Firebase-backed User model."""

    def __init__(self, data: dict, uid: int):
        self.id = uid
        self.username = data.get("username", "")
        self.email = data.get("email", "")
        self.full_name = data.get("full_name", "")
        self.hashed_password = data.get("hashed_password", "")
        self.avatar_url = data.get("avatar_url", "")
        self.created_at = data.get("created_at", "")
        self.is_active = data.get("is_active", True)

    def to_dict(self) -> dict:
        return {
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "hashed_password": self.hashed_password,
            "avatar_url": self.avatar_url,
            "created_at": self.created_at,
            "is_active": self.is_active,
        }

    @staticmethod
    def create(username: str, email: str, full_name: str, hashed_password: str, avatar_url: str = "") -> "User":
        uid = get_next_id("users")
        data = {
            "username": username,
            "email": email,
            "full_name": full_name,
            "hashed_password": hashed_password,
            "avatar_url": avatar_url,
            "created_at": _now_iso(),
            "is_active": True,
        }
        get_db_ref(f"/users/{uid}").set(data)
        return User(data, uid)

    @staticmethod
    def get_by_id(uid: int) -> Optional["User"]:
        data = get_db_ref(f"/users/{uid}").get()
        if data:
            return User(data, uid)
        return None

    @staticmethod
    def get_by_username(username: str) -> Optional["User"]:
        all_users = get_db_ref("/users").get()
        for uid, data in _iter_collection(all_users):
            if data.get("username") == username:
                return User(data, uid)
        return None

    @staticmethod
    def get_by_email(email: str) -> Optional["User"]:
        all_users = get_db_ref("/users").get()
        for uid, data in _iter_collection(all_users):
            if data.get("email") == email:
                return User(data, uid)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
#  DOCUMENT
# ═══════════════════════════════════════════════════════════════════════════════


class Document:
    """Firebase-backed Document model."""

    def __init__(self, data: dict, doc_id: int):
        self.id = doc_id
        self.title = data.get("title", "")
        self.filename = data.get("filename", "")
        self.file_type = data.get("file_type", "")
        self.file_size = data.get("file_size", 0)
        self.content_text = data.get("content_text", "")
        self.chunk_count = data.get("chunk_count", 0)
        self.is_processed = data.get("is_processed", False)
        self.uploaded_at = data.get("uploaded_at", "")
        self.user_id = data.get("user_id", 0)

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "filename": self.filename,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "content_text": self.content_text,
            "chunk_count": self.chunk_count,
            "is_processed": self.is_processed,
            "uploaded_at": self.uploaded_at,
            "user_id": self.user_id,
        }

    @staticmethod
    def create(title: str, filename: str, file_type: str, file_size: int,
               content_text: str, user_id: int) -> "Document":
        doc_id = get_next_id("documents")
        data = {
            "title": title,
            "filename": filename,
            "file_type": file_type,
            "file_size": file_size,
            "content_text": content_text,
            "chunk_count": 0,
            "is_processed": False,
            "uploaded_at": _now_iso(),
            "user_id": user_id,
        }
        get_db_ref(f"/documents/{doc_id}").set(data)
        return Document(data, doc_id)

    @staticmethod
    def get_by_id(doc_id: int) -> Optional["Document"]:
        data = get_db_ref(f"/documents/{doc_id}").get()
        if data and isinstance(data, dict):
            return Document(data, doc_id)
        return None

    @staticmethod
    def get_by_id_and_user(doc_id: int, user_id: int) -> Optional["Document"]:
        doc = Document.get_by_id(doc_id)
        if doc and doc.user_id == user_id:
            return doc
        return None

    @staticmethod
    def list_by_user(user_id: int) -> List["Document"]:
        all_docs = get_db_ref("/documents").get()
        docs = []
        for did, data in _iter_collection(all_docs):
            if data.get("user_id") == user_id:
                docs.append(Document(data, did))
        # Sort by uploaded_at descending
        docs.sort(key=lambda d: d.uploaded_at or "", reverse=True)
        return docs

    def update(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
        get_db_ref(f"/documents/{self.id}").update(kwargs)

    def delete(self):
        # Delete associated data
        _delete_by_field("quizzes", "document_id", self.id)
        _delete_by_field("flashcards", "document_id", self.id)
        _delete_by_field("chat_messages", "document_id", self.id)
        _delete_by_field("tasks", "document_id", self.id)
        get_db_ref(f"/documents/{self.id}").delete()


# ═══════════════════════════════════════════════════════════════════════════════
#  QUIZ
# ═══════════════════════════════════════════════════════════════════════════════


class Quiz:
    """Firebase-backed Quiz model."""

    def __init__(self, data: dict, quiz_id: int):
        self.id = quiz_id
        self.title = data.get("title", "")
        self.questions = data.get("questions", [])
        self.total_questions = data.get("total_questions", 0)
        self.score = data.get("score")
        self.user_answers = data.get("user_answers")
        self.created_at = data.get("created_at", "")
        self.completed_at = data.get("completed_at")
        self.document_id = data.get("document_id", 0)

    @staticmethod
    def create(title: str, questions: list, total_questions: int, document_id: int) -> "Quiz":
        quiz_id = get_next_id("quizzes")
        data = {
            "title": title,
            "questions": questions,
            "total_questions": total_questions,
            "score": None,
            "user_answers": None,
            "created_at": _now_iso(),
            "completed_at": None,
            "document_id": document_id,
        }
        get_db_ref(f"/quizzes/{quiz_id}").set(data)
        return Quiz(data, quiz_id)

    @staticmethod
    def get_by_id(quiz_id: int) -> Optional["Quiz"]:
        data = get_db_ref(f"/quizzes/{quiz_id}").get()
        if data and isinstance(data, dict):
            return Quiz(data, quiz_id)
        return None

    @staticmethod
    def list_by_document(document_id: int) -> List["Quiz"]:
        all_q = get_db_ref("/quizzes").get()
        result = []
        for qid, data in _iter_collection(all_q):
            if data.get("document_id") == document_id:
                result.append(Quiz(data, qid))
        result.sort(key=lambda q: q.created_at or "", reverse=True)
        return result

    @staticmethod
    def list_by_user(user_id: int) -> List["Quiz"]:
        """Get all quizzes for documents owned by a user."""
        user_doc_ids = {d.id for d in Document.list_by_user(user_id)}
        all_q = get_db_ref("/quizzes").get()
        result = []
        for qid, data in _iter_collection(all_q):
            if data.get("document_id") in user_doc_ids:
                result.append(Quiz(data, qid))
        return result

    def update(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
        get_db_ref(f"/quizzes/{self.id}").update(kwargs)


# ═══════════════════════════════════════════════════════════════════════════════
#  FLASHCARD
# ═══════════════════════════════════════════════════════════════════════════════


class Flashcard:
    """Firebase-backed Flashcard model."""

    def __init__(self, data: dict, card_id: int):
        self.id = card_id
        self.front = data.get("front", "")
        self.back = data.get("back", "")
        self.difficulty = data.get("difficulty", "medium")
        self.is_mastered = data.get("is_mastered", False)
        self.review_count = data.get("review_count", 0)
        self.created_at = data.get("created_at", "")
        self.document_id = data.get("document_id", 0)

    @staticmethod
    def create(front: str, back: str, difficulty: str, document_id: int) -> "Flashcard":
        card_id = get_next_id("flashcards")
        data = {
            "front": front,
            "back": back,
            "difficulty": difficulty,
            "is_mastered": False,
            "review_count": 0,
            "created_at": _now_iso(),
            "document_id": document_id,
        }
        get_db_ref(f"/flashcards/{card_id}").set(data)
        return Flashcard(data, card_id)

    @staticmethod
    def get_by_id(card_id: int) -> Optional["Flashcard"]:
        data = get_db_ref(f"/flashcards/{card_id}").get()
        if data and isinstance(data, dict):
            return Flashcard(data, card_id)
        return None

    @staticmethod
    def list_by_document(document_id: int) -> List["Flashcard"]:
        all_fc = get_db_ref("/flashcards").get()
        result = []
        for cid, data in _iter_collection(all_fc):
            if data.get("document_id") == document_id:
                result.append(Flashcard(data, cid))
        return result

    @staticmethod
    def list_by_user(user_id: int) -> List["Flashcard"]:
        user_doc_ids = {d.id for d in Document.list_by_user(user_id)}
        all_fc = get_db_ref("/flashcards").get()
        result = []
        for cid, data in _iter_collection(all_fc):
            if data.get("document_id") in user_doc_ids:
                result.append(Flashcard(data, cid))
        return result

    def update(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
        get_db_ref(f"/flashcards/{self.id}").update(kwargs)


# ═══════════════════════════════════════════════════════════════════════════════
#  CHAT MESSAGE
# ═══════════════════════════════════════════════════════════════════════════════


class ChatMessage:
    """Firebase-backed ChatMessage model."""

    def __init__(self, data: dict, msg_id: int):
        self.id = msg_id
        self.role = data.get("role", "")
        self.content = data.get("content", "")
        self.created_at = data.get("created_at", "")
        self.user_id = data.get("user_id", 0)
        self.document_id = data.get("document_id", 0)

    @staticmethod
    def create(role: str, content: str, user_id: int, document_id: int) -> "ChatMessage":
        msg_id = get_next_id("chat_messages")
        data = {
            "role": role,
            "content": content,
            "created_at": _now_iso(),
            "user_id": user_id,
            "document_id": document_id,
        }
        get_db_ref(f"/chat_messages/{msg_id}").set(data)
        return ChatMessage(data, msg_id)

    @staticmethod
    def list_by_document_and_user(document_id: int, user_id: int) -> List["ChatMessage"]:
        all_msgs = get_db_ref("/chat_messages").get()
        result = []
        for mid, data in _iter_collection(all_msgs):
            if data.get("document_id") == document_id and data.get("user_id") == user_id:
                result.append(ChatMessage(data, mid))
        result.sort(key=lambda m: m.created_at or "")
        return result


# ═══════════════════════════════════════════════════════════════════════════════
#  TASK
# ═══════════════════════════════════════════════════════════════════════════════


class Task:
    """Firebase-backed Task model."""

    def __init__(self, data: dict, task_id: int):
        self.id = task_id
        self.title = data.get("title", "")
        self.description = data.get("description", "")
        self.task_type = data.get("task_type", "reading")
        self.difficulty = data.get("difficulty", "medium")
        self.is_completed = data.get("is_completed", False)
        self.estimated_minutes = data.get("estimated_minutes", 15)
        self.created_at = data.get("created_at", "")
        self.completed_at = data.get("completed_at")
        self.document_id = data.get("document_id", 0)

    @staticmethod
    def create(title: str, description: str, task_type: str, difficulty: str,
               estimated_minutes: int, document_id: int) -> "Task":
        task_id = get_next_id("tasks")
        data = {
            "title": title,
            "description": description,
            "task_type": task_type,
            "difficulty": difficulty,
            "is_completed": False,
            "estimated_minutes": estimated_minutes,
            "created_at": _now_iso(),
            "completed_at": None,
            "document_id": document_id,
        }
        get_db_ref(f"/tasks/{task_id}").set(data)
        return Task(data, task_id)

    @staticmethod
    def get_by_id(task_id: int) -> Optional["Task"]:
        data = get_db_ref(f"/tasks/{task_id}").get()
        if data and isinstance(data, dict):
            return Task(data, task_id)
        return None

    @staticmethod
    def list_by_document(document_id: int) -> List["Task"]:
        all_tasks = get_db_ref("/tasks").get()
        result = []
        for tid, data in _iter_collection(all_tasks):
            if data.get("document_id") == document_id:
                result.append(Task(data, tid))
        return result

    @staticmethod
    def list_by_user(user_id: int) -> List["Task"]:
        user_doc_ids = {d.id for d in Document.list_by_user(user_id)}
        all_tasks = get_db_ref("/tasks").get()
        result = []
        for tid, data in _iter_collection(all_tasks):
            if data.get("document_id") in user_doc_ids:
                result.append(Task(data, tid))
        return result

    def update(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
        get_db_ref(f"/tasks/{self.id}").update(kwargs)


# ═══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def _delete_by_field(collection: str, field: str, value: Any):
    """Delete all records in a collection where field == value."""
    all_data = get_db_ref(f"/{collection}").get()
    for key, data in _iter_collection(all_data):
        if data.get(field) == value:
            get_db_ref(f"/{collection}/{key}").delete()
