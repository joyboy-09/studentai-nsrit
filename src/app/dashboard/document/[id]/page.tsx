"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  Brain,
  ArrowLeft,
  FileQuestion,
  Layers,
  MessageCircle,
  CheckSquare,
  Sparkles,
  Send,
  RotateCcw,
  Check,
  X,
  Clock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Star,
  Trophy,
  AlertCircle,
} from "lucide-react";
import { api, getToken, getDisplayName, getUserInitials, logout } from "@/lib/api";
import toast from "react-hot-toast";

type Tab = "quiz" | "flashcards" | "chat" | "tasks";

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

interface Flashcard {
  id: number;
  front: string;
  back: string;
  difficulty: string;
  is_mastered: boolean;
  review_count: number;
}

interface ChatMsg {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

interface TaskItem {
  id: number;
  title: string;
  description: string;
  task_type: string;
  difficulty: string;
  estimated_minutes: number;
  is_completed: boolean;
}

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const docId = Number(params.id);

  const [doc, setDoc] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("quiz");
  const [loading, setLoading] = useState(true);

  // Quiz state
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [quizResults, setQuizResults] = useState<any>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  // Flashcard state
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Task state
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    loadDocument();
  }, [docId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const loadDocument = async () => {
    try {
      const d = await api.getDocument(docId);
      setDoc(d);
      await Promise.all([loadQuizzes(), loadFlashcards(), loadChat(), loadTasks()]);
    } catch (err: any) {
      toast.error(err.message || "Document not found");
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadQuizzes = async () => {
    try {
      const q = await api.listQuizzes(docId);
      setQuizzes(q);
    } catch (err) {}
  };

  const loadFlashcards = async () => {
    try {
      const c = await api.listFlashcards(docId);
      setFlashcards(c);
    } catch (err) {}
  };

  const loadChat = async () => {
    try {
      const m = await api.getChatHistory(docId);
      setChatMessages(m);
    } catch (err) {}
  };

  const loadTasks = async () => {
    try {
      const t = await api.listTasks(docId);
      setTasks(t);
    } catch (err) {}
  };

  // ─── Quiz Functions ───
  const handleGenerateQuiz = async () => {
    setGeneratingQuiz(true);
    try {
      const quiz = await api.generateQuiz(docId);
      setActiveQuiz(quiz);
      setUserAnswers(new Array(quiz.questions.length).fill(-1));
      setCurrentQ(0);
      setQuizResults(null);
      toast.success("Quiz generated successfully!");
      loadQuizzes();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate quiz");
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const selectAnswer = (qIdx: number, aIdx: number) => {
    if (quizResults) return;
    const newAnswers = [...userAnswers];
    newAnswers[qIdx] = aIdx;
    setUserAnswers(newAnswers);
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    try {
      const res = await api.submitQuiz(activeQuiz.id, userAnswers);
      setQuizResults(res);
      toast.success(`Score: ${res.score.toFixed(0)}% (${res.correct}/${res.total})`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit quiz");
    }
  };

  const loadQuizById = async (quizId: number) => {
    try {
      const q = await api.getQuiz(quizId);
      setActiveQuiz(q);
      setUserAnswers(q.user_answers || new Array(q.questions.length).fill(-1));
      setCurrentQ(0);
      setQuizResults(
        q.score !== null
          ? { score: q.score, correct: 0, total: q.total_questions, results: [] }
          : null
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to load quiz");
    }
  };

  // ─── Flashcard Functions ───
  const handleGenerateFlashcards = async () => {
    setGeneratingCards(true);
    try {
      const cards = await api.generateFlashcards(docId);
      setFlashcards(cards);
      setCurrentCard(0);
      setIsFlipped(false);
      toast.success("Flashcards generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate flashcards");
    } finally {
      setGeneratingCards(false);
    }
  };

  const toggleMastered = async (cardId: number) => {
    try {
      await api.updateFlashcard(cardId);
      loadFlashcards();
    } catch (err) {}
  };

  // ─── Chat Functions ───
  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput;
    setChatInput("");
    setChatMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: msg, created_at: new Date().toISOString() },
    ]);
    setChatLoading(true);
    try {
      const res = await api.chat(docId, msg);
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: res.response,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // ─── Task Functions ───
  const handleGenerateTasks = async () => {
    setGeneratingTasks(true);
    try {
      const t = await api.generateTasks(docId);
      setTasks(t);
      toast.success("Study tasks generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate tasks");
    } finally {
      setGeneratingTasks(false);
    }
  };

  const toggleTask = async (taskId: number, current: boolean) => {
    try {
      await api.updateTask(taskId, !current);
      loadTasks();
    } catch (err) {}
  };

  const tabs: { key: Tab; label: string; icon: any; color: string }[] = [
    { key: "quiz", label: "Quiz", icon: FileQuestion, color: "#2c3e6b" },
    { key: "flashcards", label: "Flashcards", icon: Layers, color: "#2d7a5f" },
    { key: "chat", label: "AI Chat", icon: MessageCircle, color: "#8b3a4a" },
    { key: "tasks", label: "Tasks", icon: CheckSquare, color: "#c87a2a" },
  ];

  const difficultyColor: Record<string, string> = {
    easy: "badge-green",
    medium: "badge-orange",
    hard: "badge-red",
  };

  const taskTypeEmoji: Record<string, string> = {
    reading: "📖",
    practice: "✍️",
    research: "🔍",
    summary: "📝",
    discussion: "💬",
    creative: "🎨",
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{
            width: 40,
            height: 40,
            border: "3px solid var(--accent-amber)",
            borderTopColor: "transparent",
            borderRadius: "50%",
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Navbar */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "14px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-secondary)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="btn-icon" onClick={() => router.push("/dashboard")}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "'Playfair Display', Georgia, serif",
                color: "var(--text-primary)",
              }}
            >
              {doc?.title}
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Source Sans 3', sans-serif" }}>
              {doc?.file_type?.toUpperCase()} · {doc?.chunk_count} chunks analyzed
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, var(--accent-navy), var(--accent-emerald))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Source Sans 3', sans-serif",
            }}
          >
            {getUserInitials()}
          </div>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {getDisplayName(true)}
          </span>
          <button className="btn-icon" onClick={logout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 32,
            flexWrap: "wrap",
            background: "var(--bg-card)",
            borderRadius: 12,
            padding: 6,
            border: "1px solid var(--border-color)",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`tab-button ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: 1,
                justifyContent: "center",
                fontFamily: "'Source Sans 3', sans-serif",
              }}
            >
              <t.icon size={15} color={tab === t.key ? t.color : undefined} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ QUIZ TAB ═══ */}
        {tab === "quiz" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number], duration: 0.4 }}
          >
            {!activeQuiz ? (
              <div>
                <div
                  className="glass-card"
                  style={{ padding: "56px 44px", textAlign: "center", marginBottom: 28 }}
                >
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 16,
                      background: "rgba(44, 62, 107, 0.08)",
                      border: "1px solid rgba(44, 62, 107, 0.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 18px",
                    }}
                  >
                    <FileQuestion size={30} color="var(--accent-navy)" />
                  </div>
                  <h3
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      marginBottom: 10,
                      fontFamily: "'Playfair Display', Georgia, serif",
                      color: "var(--text-primary)",
                    }}
                  >
                    Examination Paper
                  </h3>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      marginBottom: 32,
                      fontSize: 15,
                      maxWidth: 420,
                      margin: "0 auto 32px",
                      lineHeight: 1.7,
                      fontFamily: "'Source Sans 3', sans-serif",
                    }}
                  >
                    Generate a multiple-choice examination from your document to assess your comprehension and recall
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary"
                    onClick={handleGenerateQuiz}
                    disabled={generatingQuiz}
                    style={{ padding: "14px 34px" }}
                  >
                    {generatingQuiz ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          style={{
                            display: "inline-block",
                            width: 16,
                            height: 16,
                            border: "2px solid white",
                            borderTopColor: "transparent",
                            borderRadius: "50%",
                          }}
                        />
                        Composing Quiz...
                      </span>
                    ) : (
                      <>
                        <Sparkles size={16} /> Generate New Quiz
                      </>
                    )}
                  </motion.button>
                </div>

                {quizzes.length > 0 && (
                  <div>
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 14,
                        color: "var(--text-secondary)",
                        fontFamily: "'Playfair Display', Georgia, serif",
                      }}
                    >
                      Previous Examinations
                    </h3>
                    <div style={{ display: "grid", gap: 10 }}>
                      {quizzes.map((q) => (
                        <div
                          key={q.id}
                          className="glass-card"
                          style={{
                            padding: "16px 22px",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                          onClick={() => loadQuizById(q.id)}
                        >
                          <span style={{ fontSize: 14, fontWeight: 500, fontFamily: "'Source Sans 3', sans-serif" }}>
                            {q.title}
                          </span>
                          <div style={{ display: "flex", gap: 8 }}>
                            {q.score !== null && (
                              <span className="badge badge-green">{q.score.toFixed(0)}%</span>
                            )}
                            <span className="badge badge-purple">{q.total_questions} Q</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 22,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      fontFamily: "'Playfair Display', Georgia, serif",
                      color: "var(--text-primary)",
                    }}
                  >
                    {activeQuiz.title}
                  </h3>
                  <button
                    className="btn-secondary"
                    style={{ padding: "8px 18px", fontSize: 13 }}
                    onClick={() => {
                      setActiveQuiz(null);
                      setQuizResults(null);
                    }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                </div>

                {/* Question indicators */}
                <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap" }}>
                  {activeQuiz.questions.map((_: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setCurrentQ(i)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: `1px solid ${
                          currentQ === i
                            ? "var(--accent-navy)"
                            : userAnswers[i] >= 0
                            ? "var(--border-accent)"
                            : "var(--border-color)"
                        }`,
                        background:
                          currentQ === i
                            ? "var(--accent-navy)"
                            : userAnswers[i] >= 0
                            ? "rgba(200, 122, 42, 0.1)"
                            : "var(--bg-card)",
                        color:
                          currentQ === i ? "white" : "var(--text-secondary)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease",
                        fontFamily: "'Source Sans 3', sans-serif",
                      }}
                    >
                      {quizResults && quizResults.results?.[i]
                        ? quizResults.results[i].is_correct
                          ? "✓"
                          : "✗"
                        : i + 1}
                    </button>
                  ))}
                </div>

                {/* Current question */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQ}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number], duration: 0.3 }}
                    className="glass-card"
                    style={{ padding: 32 }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginBottom: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        fontFamily: "'Source Sans 3', sans-serif",
                      }}
                    >
                      Question {currentQ + 1} of {activeQuiz.questions.length}
                    </p>
                    <h4
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        marginBottom: 24,
                        lineHeight: 1.7,
                        fontFamily: "'Playfair Display', Georgia, serif",
                        color: "var(--text-primary)",
                      }}
                    >
                      {activeQuiz.questions[currentQ]?.question}
                    </h4>
                    <div style={{ display: "grid", gap: 12 }}>
                      {activeQuiz.questions[currentQ]?.options.map(
                        (opt: string, oi: number) => {
                          const isSelected = userAnswers[currentQ] === oi;
                          const isCorrect =
                            quizResults &&
                            activeQuiz.questions[currentQ]?.correct_answer === oi;
                          const isWrong = quizResults && isSelected && !isCorrect;
                          return (
                            <motion.button
                              key={oi}
                              whileHover={!quizResults ? { scale: 1.01 } : {}}
                              whileTap={!quizResults ? { scale: 0.99 } : {}}
                              onClick={() => selectAnswer(currentQ, oi)}
                              style={{
                                padding: "15px 20px",
                                borderRadius: 10,
                                border: `1px solid ${
                                  isCorrect
                                    ? "var(--accent-emerald)"
                                    : isWrong
                                    ? "var(--accent-burgundy)"
                                    : isSelected
                                    ? "var(--accent-amber)"
                                    : "var(--border-color)"
                                }`,
                                background: isCorrect
                                  ? "rgba(45, 122, 95, 0.08)"
                                  : isWrong
                                  ? "rgba(139, 58, 74, 0.08)"
                                  : isSelected
                                  ? "rgba(200, 122, 42, 0.08)"
                                  : "var(--bg-card)",
                                textAlign: "left",
                                cursor: quizResults ? "default" : "pointer",
                                color: "var(--text-primary)",
                                fontSize: 14,
                                fontFamily: "'Source Sans 3', sans-serif",
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                transition: "all 0.2s ease",
                              }}
                            >
                              <span
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 7,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: isSelected
                                    ? "var(--accent-amber)"
                                    : "rgba(200, 122, 42, 0.06)",
                                  color: isSelected
                                    ? "white"
                                    : "var(--text-muted)",
                                  flexShrink: 0,
                                  border: isSelected ? "none" : "1px solid var(--border-color)",
                                }}
                              >
                                {String.fromCharCode(65 + oi)}
                              </span>
                              {opt}
                            </motion.button>
                          );
                        }
                      )}
                    </div>
                    {quizResults && activeQuiz.questions[currentQ]?.explanation && (
                      <div
                        style={{
                          marginTop: 20,
                          padding: 16,
                          borderRadius: 10,
                          background: "rgba(44, 62, 107, 0.05)",
                          border: "1px solid rgba(44, 62, 107, 0.15)",
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          lineHeight: 1.7,
                          display: "flex",
                          gap: 10,
                          fontFamily: "'Source Sans 3', sans-serif",
                        }}
                      >
                        <AlertCircle
                          size={16}
                          color="var(--accent-navy)"
                          style={{ flexShrink: 0, marginTop: 2 }}
                        />
                        {activeQuiz.questions[currentQ].explanation}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 18,
                  }}
                >
                  <button
                    className="btn-secondary"
                    disabled={currentQ === 0}
                    onClick={() => setCurrentQ(currentQ - 1)}
                    style={{ padding: "11px 22px" }}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  {currentQ < activeQuiz.questions.length - 1 ? (
                    <button
                      className="btn-primary"
                      onClick={() => setCurrentQ(currentQ + 1)}
                      style={{ padding: "11px 22px" }}
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  ) : !quizResults ? (
                    <button
                      className="btn-primary"
                      onClick={submitQuiz}
                      style={{ padding: "11px 22px" }}
                    >
                      <Trophy size={16} /> Submit Answers
                    </button>
                  ) : (
                    <div
                      className="badge badge-green"
                      style={{ fontSize: 15, padding: "11px 22px" }}
                    >
                      Score: {quizResults.score.toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ FLASHCARDS TAB ═══ */}
        {tab === "flashcards" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number], duration: 0.4 }}
          >
            {flashcards.length === 0 ? (
              <div
                className="glass-card"
                style={{ padding: "56px 44px", textAlign: "center" }}
              >
                <div
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 16,
                    background: "rgba(45, 122, 95, 0.08)",
                    border: "1px solid rgba(45, 122, 95, 0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 18px",
                  }}
                >
                  <Layers size={30} color="var(--accent-emerald)" />
                </div>
                <h3
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    marginBottom: 10,
                    fontFamily: "'Playfair Display', Georgia, serif",
                    color: "var(--text-primary)",
                  }}
                >
                  Study Flashcards
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    marginBottom: 32,
                    fontSize: 15,
                    maxWidth: 420,
                    margin: "0 auto 32px",
                    lineHeight: 1.7,
                    fontFamily: "'Source Sans 3', sans-serif",
                  }}
                >
                  Generate elegant flashcards from your material for efficient revision and spaced repetition
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary"
                  onClick={handleGenerateFlashcards}
                  disabled={generatingCards}
                  style={{ padding: "14px 34px" }}
                >
                  {generatingCards ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        style={{
                          display: "inline-block",
                          width: 16,
                          height: 16,
                          border: "2px solid white",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                        }}
                      />
                      Preparing Cards...
                    </span>
                  ) : (
                    <>
                      <Sparkles size={16} /> Generate Flashcards
                    </>
                  )}
                </motion.button>
              </div>
            ) : (
              <div>
                {/* Progress info */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'Source Sans 3', sans-serif" }}>
                    Card {currentCard + 1} of {flashcards.length} ·{" "}
                    {flashcards.filter((c) => c.is_mastered).length} mastered
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span
                      className={`badge ${
                        difficultyColor[flashcards[currentCard]?.difficulty] || "badge-green"
                      }`}
                    >
                      {flashcards[currentCard]?.difficulty}
                    </span>
                    <button
                      className="btn-secondary"
                      style={{ padding: "6px 14px", fontSize: 12 }}
                      onClick={handleGenerateFlashcards}
                      disabled={generatingCards}
                    >
                      <RotateCcw size={13} /> New Set
                    </button>
                  </div>
                </div>

                {/* Flashcard with 3D flip */}
                <div style={{ perspective: 1200, marginBottom: 22 }}>
                  <motion.div
                    onClick={() => setIsFlipped(!isFlipped)}
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.55, type: "spring", stiffness: 90 }}
                    style={{
                      minHeight: 280,
                      cursor: "pointer",
                      transformStyle: "preserve-3d",
                      position: "relative",
                    }}
                  >
                    {/* Front */}
                    <div
                      className="glass-card"
                      style={{
                        position: "absolute",
                        inset: 0,
                        backfaceVisibility: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 44,
                        textAlign: "center",
                        background:
                          "linear-gradient(135deg, rgba(45, 122, 95, 0.04), rgba(200, 122, 42, 0.04))",
                        borderColor: "var(--border-accent)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginBottom: 16,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          fontFamily: "'Source Sans 3', sans-serif",
                        }}
                      >
                        Question
                      </span>
                      <p
                        style={{
                          fontSize: 19,
                          fontWeight: 600,
                          lineHeight: 1.7,
                          fontFamily: "'Playfair Display', Georgia, serif",
                          color: "var(--text-primary)",
                        }}
                      >
                        {flashcards[currentCard]?.front}
                      </p>
                      <span
                        style={{
                          marginTop: 24,
                          fontSize: 11,
                          color: "var(--text-muted)",
                          fontFamily: "'Source Sans 3', sans-serif",
                        }}
                      >
                        Click to reveal answer
                      </span>
                    </div>

                    {/* Back */}
                    <div
                      className="glass-card"
                      style={{
                        position: "absolute",
                        inset: 0,
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 44,
                        textAlign: "center",
                        background:
                          "linear-gradient(135deg, rgba(200, 122, 42, 0.05), rgba(45, 122, 95, 0.04))",
                        borderColor: "var(--accent-emerald)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--accent-emerald)",
                          marginBottom: 16,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          fontFamily: "'Source Sans 3', sans-serif",
                        }}
                      >
                        Answer
                      </span>
                      <p
                        style={{
                          fontSize: 16,
                          fontWeight: 500,
                          lineHeight: 1.8,
                          color: "var(--text-primary)",
                          fontFamily: "'Source Sans 3', sans-serif",
                        }}
                      >
                        {flashcards[currentCard]?.back}
                      </p>
                    </div>
                  </motion.div>
                </div>

                {/* Controls */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <button
                    className="btn-secondary"
                    disabled={currentCard === 0}
                    onClick={() => {
                      setCurrentCard(currentCard - 1);
                      setIsFlipped(false);
                    }}
                    style={{ padding: "11px 22px" }}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleMastered(flashcards[currentCard]?.id)}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 20,
                      border: `1px solid ${
                        flashcards[currentCard]?.is_mastered
                          ? "var(--accent-emerald)"
                          : "var(--border-color)"
                      }`,
                      background: flashcards[currentCard]?.is_mastered
                        ? "rgba(45, 122, 95, 0.1)"
                        : "var(--bg-card)",
                      color: flashcards[currentCard]?.is_mastered
                        ? "var(--accent-emerald)"
                        : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontFamily: "'Source Sans 3', sans-serif",
                    }}
                  >
                    <Star
                      size={15}
                      fill={
                        flashcards[currentCard]?.is_mastered
                          ? "var(--accent-emerald)"
                          : "none"
                      }
                    />
                    {flashcards[currentCard]?.is_mastered ? "Mastered" : "Mark Mastered"}
                  </motion.button>
                  <button
                    className="btn-primary"
                    disabled={currentCard >= flashcards.length - 1}
                    onClick={() => {
                      setCurrentCard(currentCard + 1);
                      setIsFlipped(false);
                    }}
                    style={{ padding: "11px 22px" }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ CHAT TAB ═══ */}
        {tab === "chat" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number], duration: 0.4 }}
            style={{
              display: "flex",
              flexDirection: "column",
              height: "calc(100vh - 200px)",
            }}
          >
            {/* Messages */}
            <div
              className="glass-card"
              style={{
                flex: 1,
                overflow: "auto",
                padding: 22,
                marginBottom: 14,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {chatMessages.length === 0 && (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 14,
                      background: "rgba(139, 58, 74, 0.08)",
                      border: "1px solid rgba(139, 58, 74, 0.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    <MessageCircle size={26} color="var(--accent-burgundy)" />
                  </div>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      fontFamily: "'Playfair Display', Georgia, serif",
                    }}
                  >
                    Consult Your Study Material
                  </p>
                  <p style={{ fontSize: 13, marginTop: 6, fontFamily: "'Source Sans 3', sans-serif" }}>
                    Ask anything — the AI tutor answers from your document
                  </p>
                </div>
              )}
              {chatMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number], duration: 0.3 }}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    className={msg.role === "assistant" ? "chat-content" : ""}
                    style={{
                      maxWidth: "80%",
                      padding: "13px 18px",
                      borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background:
                        msg.role === "user"
                          ? "var(--accent-amber)"
                          : "var(--bg-card)",
                      border:
                        msg.role === "user"
                          ? "none"
                          : "1px solid var(--border-color)",
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: msg.role === "user" ? "white" : "var(--text-primary)",
                      fontFamily: "'Source Sans 3', sans-serif",
                    }}
                  >
                    {msg.role === "assistant" ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </motion.div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", gap: 5, padding: "13px 18px" }}>
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: 10 }}>
              <input
                className="input-field"
                placeholder="Ask a question about your document..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                disabled={chatLoading}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary"
                onClick={sendMessage}
                disabled={chatLoading || !chatInput.trim()}
                style={{ padding: "12px 22px" }}
              >
                <Send size={17} />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ═══ TASKS TAB ═══ */}
        {tab === "tasks" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number], duration: 0.4 }}
          >
            {tasks.length === 0 ? (
              <div
                className="glass-card"
                style={{ padding: "56px 44px", textAlign: "center" }}
              >
                <div
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 16,
                    background: "rgba(200, 122, 42, 0.08)",
                    border: "1px solid rgba(200, 122, 42, 0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 18px",
                  }}
                >
                  <CheckSquare size={30} color="var(--accent-amber)" />
                </div>
                <h3
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    marginBottom: 10,
                    fontFamily: "'Playfair Display', Georgia, serif",
                    color: "var(--text-primary)",
                  }}
                >
                  Study Planner
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    marginBottom: 32,
                    fontSize: 15,
                    maxWidth: 420,
                    margin: "0 auto 32px",
                    lineHeight: 1.7,
                    fontFamily: "'Source Sans 3', sans-serif",
                  }}
                >
                  Receive tailored study tasks to systematically master this material, one step at a time
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary"
                  onClick={handleGenerateTasks}
                  disabled={generatingTasks}
                  style={{ padding: "14px 34px" }}
                >
                  {generatingTasks ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        style={{
                          display: "inline-block",
                          width: 16,
                          height: 16,
                          border: "2px solid white",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                        }}
                      />
                      Planning...
                    </span>
                  ) : (
                    <>
                      <Sparkles size={16} /> Generate Study Tasks
                    </>
                  )}
                </motion.button>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--text-secondary)",
                      fontFamily: "'Source Sans 3', sans-serif",
                    }}
                  >
                    {tasks.filter((t) => t.is_completed).length}/{tasks.length} tasks
                    completed
                  </span>
                  <button
                    className="btn-secondary"
                    style={{ padding: "6px 14px", fontSize: 12 }}
                    onClick={handleGenerateTasks}
                    disabled={generatingTasks}
                  >
                    <RotateCcw size={13} /> Regenerate
                  </button>
                </div>

                {/* Progress bar */}
                <div className="progress-bar" style={{ marginBottom: 22 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${
                        tasks.length > 0
                          ? (tasks.filter((t) => t.is_completed).length / tasks.length) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {tasks.map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
                      className="glass-card"
                      style={{
                        padding: "18px 22px",
                        opacity: task.is_completed ? 0.6 : 1,
                      }}
                    >
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => toggleTask(task.id, task.is_completed)}
                          style={{
                            marginTop: 2,
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            border: `2px solid ${
                              task.is_completed
                                ? "var(--accent-emerald)"
                                : "var(--border-strong)"
                            }`,
                            background: task.is_completed
                              ? "var(--accent-emerald)"
                              : "transparent",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {task.is_completed && <Check size={13} color="white" />}
                        </motion.button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 5,
                            }}
                          >
                            <span>{taskTypeEmoji[task.task_type] || "📌"}</span>
                            <h4
                              style={{
                                fontSize: 15,
                                fontWeight: 600,
                                textDecoration: task.is_completed
                                  ? "line-through"
                                  : "none",
                                fontFamily: "'Playfair Display', Georgia, serif",
                                color: "var(--text-primary)",
                              }}
                            >
                              {task.title}
                            </h4>
                          </div>
                          <p
                            style={{
                              fontSize: 13,
                              color: "var(--text-secondary)",
                              lineHeight: 1.6,
                              marginBottom: 10,
                              fontFamily: "'Source Sans 3', sans-serif",
                            }}
                          >
                            {task.description}
                          </p>
                          <div style={{ display: "flex", gap: 8 }}>
                            <span
                              className={`badge ${
                                difficultyColor[task.difficulty] || "badge-green"
                              }`}
                            >
                              {task.difficulty}
                            </span>
                            <span className="badge badge-orange">
                              <Clock size={10} /> {task.estimated_minutes} min
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
