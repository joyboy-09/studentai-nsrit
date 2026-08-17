/**
 * StudentAI — API client
 * Proper name-based entry with full_name stored, display helpers included.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Token & User Management ───────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("studentai_token");
}

export function setToken(token: string): void {
  localStorage.setItem("studentai_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("studentai_token");
}

export interface StoredUser {
  username: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
}

export function getUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("studentai_user");
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user: StoredUser): void {
  localStorage.setItem("studentai_user", JSON.stringify(user));
}

/**
 * Get a properly formatted display name for the current user.
 * Returns first name only for short display, or full name.
 */
export function getDisplayName(short: boolean = false): string {
  const user = getUser();
  if (!user) return "Student";
  const fullName = user.full_name || user.username || "Student";
  if (short) {
    return fullName.split(" ")[0] || "Student";
  }
  return fullName;
}

/**
 * Get user initials for avatar display.
 */
export function getUserInitials(): string {
  const user = getUser();
  if (!user) return "S";
  const name = user.full_name || user.username || "Student";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export function logout(): void {
  removeToken();
  localStorage.removeItem("studentai_user");
  localStorage.removeItem("studentai_notes");
  window.location.href = "/login";
}

// ─── API Fetch Wrapper ─────────────────────────────────────────────────────

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new Error(
      "Cannot connect to the server. Make sure the backend is running."
    );
  }

  if (res.status === 401) {
    throw new Error("Session issue. Please refresh the page.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${res.status})`);
  }

  return res.json();
}

// ─── API Methods ────────────────────────────────────────────────────────────

export const api = {
  // Documents
  uploadDocument: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch("/api/documents/upload", { method: "POST", body: formData });
  },

  listDocuments: () => apiFetch("/api/documents"),

  getDocument: (id: number) => apiFetch(`/api/documents/${id}`),

  deleteDocument: (id: number) => apiFetch(`/api/documents/${id}`, { method: "DELETE" }),

  // Quiz
  generateQuiz: (docId: number, numQuestions = 10) =>
    apiFetch(`/api/documents/${docId}/generate-quiz?num_questions=${numQuestions}`, { method: "POST" }),

  listQuizzes: (docId: number) => apiFetch(`/api/documents/${docId}/quizzes`),

  getQuiz: (quizId: number) => apiFetch(`/api/quizzes/${quizId}`),

  submitQuiz: (quizId: number, answers: number[]) =>
    apiFetch(`/api/quizzes/${quizId}/submit`, { method: "POST", body: JSON.stringify({ quiz_id: quizId, answers }) }),

  // Flashcards
  generateFlashcards: (docId: number, numCards = 15) =>
    apiFetch(`/api/documents/${docId}/generate-flashcards?num_cards=${numCards}`, { method: "POST" }),

  listFlashcards: (docId: number) => apiFetch(`/api/documents/${docId}/flashcards`),

  updateFlashcard: (cardId: number) => apiFetch(`/api/flashcards/${cardId}`, { method: "PATCH" }),

  // Chat
  chat: (documentId: number, message: string) =>
    apiFetch("/api/chat", { method: "POST", body: JSON.stringify({ document_id: documentId, message }) }),

  getChatHistory: (docId: number) => apiFetch(`/api/documents/${docId}/chat-history`),

  // Math
  solveMath: (problem: string) =>
    apiFetch("/api/math/solve", { method: "POST", body: JSON.stringify({ problem }) }),

  // Topic
  askTopic: (topic: string, question: string) =>
    apiFetch("/api/topic/ask", { method: "POST", body: JSON.stringify({ topic, question }) }),

  // Tasks
  generateTasks: (docId: number, numTasks = 8) =>
    apiFetch(`/api/documents/${docId}/generate-tasks?num_tasks=${numTasks}`, { method: "POST" }),

  listTasks: (docId: number) => apiFetch(`/api/documents/${docId}/tasks`),

  updateTask: (taskId: number, isCompleted: boolean) =>
    apiFetch(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ is_completed: isCompleted }) }),

  // Dashboard
  getDashboardStats: () => apiFetch("/api/dashboard/stats"),

  // Health
  checkHealth: () => apiFetch("/api/health"),
};
