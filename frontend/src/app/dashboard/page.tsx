"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  Brain,
  FileText,
  BarChart3,
  Layers,
  CheckSquare,
  LogOut,
  Trash2,
  Clock,
  FileUp,
  Sparkles,
  Calculator,
  MessageCircle,
  X,
  Timer,
  StickyNote,
  Play,
  Pause,
  RotateCcw,
  Calendar,
  User,
} from "lucide-react";
import { api, getUser, getToken, getDisplayName, getUserInitials, logout } from "@/lib/api";
import toast from "react-hot-toast";
import { useDropzone } from "react-dropzone";

interface Document {
  id: number;
  title: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  is_processed: boolean;
  uploaded_at: string;
}

interface Stats {
  total_documents: number;
  total_quizzes: number;
  completed_quizzes: number;
  average_score: number;
  total_flashcards: number;
  mastered_flashcards: number;
  total_tasks: number;
  completed_tasks: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

// ─── Date / Time helpers ────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrentTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Pomodoro helpers ───────────────────────────────────────────────────────

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ═════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUserState] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Date/Time state — auto updates
  const [currentDate, setCurrentDate] = useState(formatCurrentDate());
  const [currentTime, setCurrentTime] = useState(formatCurrentTime());
  const [greeting, setGreeting] = useState(getGreeting());

  // Math modal
  const [showMathModal, setShowMathModal] = useState(false);
  const [mathProblem, setMathProblem] = useState("");
  const [mathSolution, setMathSolution] = useState("");
  const [mathLoading, setMathLoading] = useState(false);

  // Topic modal
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicForm, setTopicForm] = useState({ topic: "", question: "" });
  const [topicAnswer, setTopicAnswer] = useState("");
  const [topicLoading, setTopicLoading] = useState(false);

  // Pomodoro timer
  const [showPomodoroModal, setShowPomodoroModal] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60); // 25 min default
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<"focus" | "break">("focus");
  const [pomodoroSessions, setPomodoroSessions] = useState(0);
  const pomodoroRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notes modal
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState("");

  const [serverStatus, setServerStatus] = useState<"ok" | "error" | "loading">("loading");

  // ─── Auto-update date/time every 30 seconds ────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(formatCurrentDate());
      setCurrentTime(formatCurrentTime());
      setGreeting(getGreeting());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // ─── Load saved notes from localStorage ────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedNotes = localStorage.getItem("studentai_notes");
      if (savedNotes) setNotes(savedNotes);
    }
  }, []);

  // ─── Save notes to localStorage on change ─────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("studentai_notes", notes);
    }
  }, [notes]);

  // ─── Pomodoro timer logic ──────────────────────────────────────────────────
  useEffect(() => {
    if (pomodoroRunning && pomodoroTime > 0) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTime((prev) => {
          if (prev <= 1) {
            // Timer finished
            setPomodoroRunning(false);
            if (pomodoroMode === "focus") {
              setPomodoroSessions((s) => s + 1);
              setPomodoroMode("break");
              toast.success("🎉 Focus session complete! Take a 5-minute break.");
              return 5 * 60; // Switch to 5-min break
            } else {
              setPomodoroMode("focus");
              toast.success("Break over! Ready for another focus session?");
              return 25 * 60; // Switch back to 25-min focus
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    }
    return () => {
      if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    };
  }, [pomodoroRunning, pomodoroMode]);

  // ─── Auth & data loading ───────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    const u = getUser();
    setUserState(u);
    loadData();
    checkServer();
  }, []);

  const checkServer = async () => {
    try {
      await api.checkHealth();
      setServerStatus("ok");
    } catch {
      setServerStatus("error");
    }
  };

  const loadData = async () => {
    try {
      const [docs, s] = await Promise.all([api.listDocuments(), api.getDashboardStats()]);
      setDocuments(docs);
      setStats(s);
    } catch (err: any) {
      if (err.message?.includes("Cannot connect")) {
        toast.error("Cannot connect to server. Make sure the backend is running.");
        setServerStatus("error");
      }
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    setUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 10, 90));
    }, 300);

    try {
      await api.uploadDocument(file);
      clearInterval(interval);
      setUploadProgress(100);
      toast.success("Document uploaded & processed!");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
      clearInterval(interval);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const deleteDoc = async (id: number) => {
    if (!confirm("Delete this document and all associated data?")) return;
    try {
      await api.deleteDocument(id);
      toast.success("Document deleted");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMathSolve = async () => {
    if (!mathProblem.trim()) return;
    setMathLoading(true);
    setMathSolution("");
    try {
      const res = await api.solveMath(mathProblem);
      setMathSolution(res.solution);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMathLoading(false);
    }
  };

  const handleTopicAsk = async () => {
    if (!topicForm.topic.trim() || !topicForm.question.trim()) return;
    setTopicLoading(true);
    setTopicAnswer("");
    try {
      const res = await api.askTopic(topicForm.topic, topicForm.question);
      setTopicAnswer(res.answer);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTopicLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fileTypeIcon: Record<string, string> = {
    pdf: "📄",
    pptx: "📊",
    ppt: "📊",
    docx: "📝",
    doc: "📝",
    txt: "📋",
  };

  const displayName = user?.full_name || user?.username || "Student";
  const shortName = displayName.split(" ")[0] || "Student";
  const initials = getUserInitials();

  const statCards = stats
    ? [
        { label: "Documents", value: stats.total_documents, icon: FileText, color: "var(--accent-amber)" },
        { label: "Avg Score", value: stats.average_score > 0 ? stats.average_score + "%" : "—", icon: BarChart3, color: "var(--accent-navy)" },
        { label: "Flashcards", value: `${stats.mastered_flashcards}/${stats.total_flashcards}`, icon: Layers, color: "var(--accent-emerald)" },
        { label: "Tasks Done", value: `${stats.completed_tasks}/${stats.total_tasks}`, icon: CheckSquare, color: "var(--accent-emerald)" },
      ]
    : [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", fontFamily: "'Source Sans 3', sans-serif" }}>
      {/* ═══ Navbar ═══ */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "14px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(250, 247, 242, 0.92)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-color)",
          boxShadow: "0 1px 3px rgba(44, 62, 107, 0.04)",
        }}
      >
        <Link
          href="/dashboard"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #c87a2a, #a0621f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(200, 122, 42, 0.25)",
            }}
          >
            <Brain size={18} color="white" />
          </div>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "'Playfair Display', Georgia, serif",
              letterSpacing: "-0.3px",
            }}
            className="gradient-text"
          >
            StudentAI
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Date & Time */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--text-muted)",
              background: "var(--bg-secondary)",
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
            }}
          >
            <Calendar size={12} />
            <span style={{ fontWeight: 500 }}>{currentDate}</span>
            <span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>·</span>
            <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{currentTime}</span>
          </div>

          {serverStatus === "error" && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent-burgundy)",
                background: "rgba(139, 58, 74, 0.08)",
                padding: "5px 12px",
                borderRadius: 8,
                border: "1px solid rgba(139, 58, 74, 0.2)",
              }}
            >
              Server Offline
            </span>
          )}

          {/* User Avatar & Name */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(135deg, var(--accent-navy), var(--accent-emerald))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'Source Sans 3', sans-serif",
              }}
            >
              {initials}
            </div>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </span>
          </div>

          <button className="btn-icon" onClick={logout} title="Logout">
            <LogOut size={17} />
          </button>
        </div>
      </motion.nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 28px" }}>
        {/* ═══ Welcome Header with Greeting + Date ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          style={{ marginBottom: 32 }}
        >
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: "'Playfair Display', Georgia, serif",
              color: "var(--text-primary)",
              marginBottom: 6,
              letterSpacing: "-0.5px",
            }}
          >
            {greeting},{" "}
            <span className="gradient-text">{shortName}</span>
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={14} /> {currentDate} — Your scholarly workspace awaits.
          </p>
        </motion.div>

        {/* ═══ Stats ═══ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              className="stat-card"
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: 14,
                padding: "22px 24px",
                boxShadow: "0 2px 8px rgba(44, 62, 107, 0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
                    {s.label}
                  </p>
                  <p className="stat-value" style={{ color: s.color, fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {s.value}
                  </p>
                </div>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: `${s.color}12`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `1px solid ${s.color}20`,
                  }}
                >
                  <s.icon size={19} color={s.color} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ═══ Quick Tools ═══ */}
        <div style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 14,
              fontFamily: "'Playfair Display', Georgia, serif",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Sparkles size={16} color="var(--accent-amber)" /> Quick Tools
          </h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { icon: Calculator, label: "Math Solver", color: "var(--accent-amber)", onClick: () => setShowMathModal(true) },
              { icon: MessageCircle, label: "Ask Any Topic", color: "var(--accent-navy)", onClick: () => setShowTopicModal(true) },
              { icon: Timer, label: "Study Timer", color: "var(--accent-emerald)", onClick: () => setShowPomodoroModal(true) },
              { icon: StickyNote, label: "Quick Notes", color: "var(--accent-burgundy)", onClick: () => setShowNotesModal(true) },
            ].map((tool) => (
              <motion.button
                key={tool.label}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={tool.onClick}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 22px",
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                  borderRadius: 12,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(44, 62, 107, 0.06)",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: `${tool.color}10`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <tool.icon size={16} color={tool.color} />
                </div>
                {tool.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ═══ Upload Area ═══ */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" style={{ marginBottom: 36 }}>
          <div
            {...getRootProps()}
            style={{
              padding: uploading ? "30px" : "48px",
              border: `2px dashed ${isDragActive ? "var(--accent-amber)" : "var(--border-strong)"}`,
              borderRadius: 16,
              background: isDragActive ? "rgba(200, 122, 42, 0.04)" : "var(--bg-card)",
              textAlign: "center",
              cursor: uploading ? "wait" : "pointer",
              transition: "all 0.25s ease",
              boxShadow: isDragActive ? "0 4px 20px rgba(200, 122, 42, 0.08)" : "0 2px 8px rgba(44, 62, 107, 0.03)",
            }}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    style={{
                      width: 20,
                      height: 20,
                      border: "2.5px solid var(--accent-amber)",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                    }}
                  />
                  <span style={{ fontSize: 14, color: "var(--text-secondary)", fontStyle: "italic" }}>
                    Processing your document...
                  </span>
                </div>
                <div className="progress-bar" style={{ maxWidth: 300, margin: "0 auto", borderRadius: 6, height: 6, background: "var(--bg-secondary)" }}>
                  <div className="progress-fill" style={{ width: `${uploadProgress}%`, height: "100%", borderRadius: 6, background: "var(--accent-amber)", transition: "width 0.3s ease" }} />
                </div>
              </div>
            ) : (
              <>
                <FileUp size={38} style={{ color: "var(--accent-amber)", marginBottom: 14 }} />
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginBottom: 8,
                    fontFamily: "'Playfair Display', Georgia, serif",
                    color: "var(--text-primary)",
                  }}
                >
                  {isDragActive ? "Release to add to your collection" : "Add to Your Collection"}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
                  Drag & drop a PDF, PowerPoint, Word, or Text file — or click to browse your library
                </p>
              </>
            )}
          </div>
        </motion.div>

        {/* ═══ Documents List ═══ */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 18,
              fontFamily: "'Playfair Display', Georgia, serif",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: 14,
            }}
          >
            <FileText size={20} color="var(--accent-navy)" /> Your Documents
          </h2>

          {documents.length === 0 ? (
            <div
              className="glass-card"
              style={{
                padding: 52,
                textAlign: "center",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: 14,
              }}
            >
              <Sparkles size={36} style={{ color: "var(--text-muted)", marginBottom: 14 }} />
              <p style={{ color: "var(--text-secondary)", fontSize: 15, fontStyle: "italic" }}>
                Your collection is empty. Upload your first study material above to begin.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <AnimatePresence>
                {documents.map((doc, i) => (
                  <motion.div
                    key={doc.id}
                    className="glass-card"
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 15 }}
                    transition={{ delay: i * 0.04 }}
                    style={{
                      padding: "20px 24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      cursor: "pointer",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 12,
                      transition: "all 0.2s ease",
                      boxShadow: "0 1px 4px rgba(44, 62, 107, 0.04)",
                    }}
                    whileHover={{
                      boxShadow: "0 4px 16px rgba(44, 62, 107, 0.08)",
                      borderColor: "var(--border-strong)",
                    }}
                    onClick={() => router.push(`/dashboard/document/${doc.id}`)}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: 28 }}>{fileTypeIcon[doc.file_type] || "📄"}</span>
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            marginBottom: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "var(--text-primary)",
                            fontFamily: "'Source Sans 3', sans-serif",
                          }}
                        >
                          {doc.title}
                        </h3>
                        <div
                          style={{
                            display: "flex",
                            gap: 14,
                            fontSize: 12,
                            color: "var(--text-muted)",
                          }}
                        >
                          <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>{doc.file_type.toUpperCase()}</span>
                          <span>{formatSize(doc.file_size)}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <Clock size={11} /> {formatDate(doc.uploaded_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span
                        className="badge badge-green"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: "rgba(45, 122, 95, 0.08)",
                          color: "var(--accent-emerald)",
                          border: "1px solid rgba(45, 122, 95, 0.15)",
                        }}
                      >
                        {doc.chunk_count} chunks
                      </span>
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDoc(doc.id);
                        }}
                        title="Delete"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          border: "1px solid var(--border-color)",
                          background: "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
           MODALS
         ═══════════════════════════════════════════════════════════════════════ */}

      {/* ─── Math Modal ─── */}
      <AnimatePresence>
        {showMathModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowMathModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title">
                  <Calculator size={20} color="var(--accent-emerald)" /> Math Solver
                </h2>
                <button className="btn-icon" onClick={() => setShowMathModal(false)}>
                  <X size={17} />
                </button>
              </div>
              <textarea
                className="input-field"
                placeholder="Enter a math problem... e.g., Solve x² + 5x + 6 = 0"
                value={mathProblem}
                onChange={(e) => setMathProblem(e.target.value)}
                rows={3}
                style={{ resize: "vertical", marginBottom: 16 }}
              />
              <button
                className="btn-primary"
                onClick={handleMathSolve}
                disabled={mathLoading}
                style={{ marginBottom: 18 }}
              >
                {mathLoading ? "Solving..." : "Solve It"}
              </button>
              {mathSolution && (
                <div className="chat-content modal-result">
                  <ReactMarkdown>{mathSolution}</ReactMarkdown>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Topic Modal ─── */}
      <AnimatePresence>
        {showTopicModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowTopicModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title">
                  <MessageCircle size={20} color="var(--accent-navy)" /> Ask Any Topic
                </h2>
                <button className="btn-icon" onClick={() => setShowTopicModal(false)}>
                  <X size={17} />
                </button>
              </div>
              <input
                className="input-field"
                placeholder="Topic (e.g., Quantum Physics, Biology)"
                value={topicForm.topic}
                onChange={(e) => setTopicForm({ ...topicForm, topic: e.target.value })}
                style={{ marginBottom: 12 }}
              />
              <textarea
                className="input-field"
                placeholder="Your question..."
                value={topicForm.question}
                onChange={(e) => setTopicForm({ ...topicForm, question: e.target.value })}
                rows={3}
                style={{ resize: "vertical", marginBottom: 16 }}
              />
              <button
                className="btn-primary"
                onClick={handleTopicAsk}
                disabled={topicLoading}
                style={{ marginBottom: 18, background: "var(--accent-navy)" }}
              >
                {topicLoading ? "Thinking..." : "Get Answer"}
              </button>
              {topicAnswer && (
                <div className="chat-content modal-result" style={{ borderColor: "rgba(44, 62, 107, 0.12)" }}>
                  <ReactMarkdown>{topicAnswer}</ReactMarkdown>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Pomodoro Timer Modal ─── */}
      <AnimatePresence>
        {showPomodoroModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowPomodoroModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              style={{ maxWidth: 420, textAlign: "center" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title">
                  <Timer size={20} color="var(--accent-emerald)" /> Study Timer
                </h2>
                <button className="btn-icon" onClick={() => setShowPomodoroModal(false)}>
                  <X size={17} />
                </button>
              </div>

              {/* Mode Badge */}
              <div style={{ marginBottom: 24 }}>
                <span
                  className={`badge ${pomodoroMode === "focus" ? "badge-orange" : "badge-green"}`}
                  style={{ fontSize: 13, padding: "6px 16px" }}
                >
                  {pomodoroMode === "focus" ? "🎯 Focus Time" : "☕ Break Time"}
                </span>
              </div>

              {/* Timer Display */}
              <div
                style={{
                  fontSize: 72,
                  fontWeight: 700,
                  fontFamily: "'Playfair Display', Georgia, serif",
                  color: pomodoroMode === "focus" ? "var(--accent-amber)" : "var(--accent-emerald)",
                  marginBottom: 8,
                  lineHeight: 1,
                  letterSpacing: "-2px",
                }}
              >
                {formatTimer(pomodoroTime)}
              </div>

              {/* Sessions Count */}
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>
                {pomodoroSessions} session{pomodoroSessions !== 1 ? "s" : ""} completed today
              </p>

              {/* Controls */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-primary"
                  onClick={() => setPomodoroRunning(!pomodoroRunning)}
                  style={{
                    padding: "14px 32px",
                    background: pomodoroRunning ? "var(--accent-burgundy)" : "var(--accent-emerald)",
                    boxShadow: pomodoroRunning
                      ? "0 2px 8px rgba(139, 58, 74, 0.25)"
                      : "0 2px 8px rgba(45, 122, 95, 0.25)",
                  }}
                >
                  {pomodoroRunning ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Start</>}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-secondary"
                  onClick={() => {
                    setPomodoroRunning(false);
                    setPomodoroMode("focus");
                    setPomodoroTime(25 * 60);
                  }}
                  style={{ padding: "14px 24px" }}
                >
                  <RotateCcw size={16} /> Reset
                </motion.button>
              </div>

              {/* Quick time presets */}
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {[
                  { label: "25 min", value: 25 },
                  { label: "45 min", value: 45 },
                  { label: "60 min", value: 60 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    className="badge badge-purple"
                    style={{ cursor: "pointer", padding: "5px 12px", fontSize: 12, border: "1px solid rgba(44, 62, 107, 0.15)" }}
                    onClick={() => {
                      setPomodoroRunning(false);
                      setPomodoroMode("focus");
                      setPomodoroTime(preset.value * 60);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Quick Notes Modal ─── */}
      <AnimatePresence>
        {showNotesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowNotesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title">
                  <StickyNote size={20} color="var(--accent-burgundy)" /> Quick Notes
                </h2>
                <button className="btn-icon" onClick={() => setShowNotesModal(false)}>
                  <X size={17} />
                </button>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                Jot down quick thoughts while studying. Notes are saved automatically.
              </p>
              <textarea
                className="input-field"
                placeholder="Write your notes here... They save automatically!"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={12}
                style={{
                  resize: "vertical",
                  lineHeight: 1.8,
                  fontSize: 14,
                  fontFamily: "'Source Sans 3', sans-serif",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 12,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {notes.length} characters · Auto-saved
                </span>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    if (confirm("Clear all notes?")) setNotes("");
                  }}
                  style={{ padding: "6px 14px", fontSize: 12 }}
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
