"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { setToken, setUser } from "@/lib/api";
import { ArrowRight, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateName = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "Please enter your name";
    if (trimmed.length < 2) return "Name must be at least 2 characters";
    if (trimmed.length > 50) return "Name is too long";
    if (!/[a-zA-Z]/.test(trimmed)) return "Name must contain at least one letter";
    return "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    const trimmedName = name.trim();

    // Generate a simple token and save user locally
    const token = btoa(
      JSON.stringify({ sub: trimmedName, exp: Date.now() + 86400000 })
    );
    setToken(token);
    setUser({
      username: trimmedName.toLowerCase().replace(/\s+/g, "_"),
      full_name: trimmedName,
    });

    router.push("/dashboard");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Source Sans 3', sans-serif",
      }}
    >
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "2.5rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "linear-gradient(135deg, #c87a2a, #2d7a5f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 3px 12px rgba(200, 122, 42, 0.3)",
            }}
          >
            <Sparkles size={20} color="white" />
          </div>
          <span
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "1.6rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            StudentAI
          </span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "1.75rem",
            fontWeight: 700,
            textAlign: "center",
            color: "var(--text-primary)",
            marginBottom: "0.5rem",
          }}
        >
          Welcome
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            marginBottom: "2rem",
            fontSize: "0.95rem",
          }}
        >
          Enter your full name to start learning
        </p>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.4rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              Your Full Name
            </label>
            <input
              className="input-field"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. Joy Sharma"
              autoFocus
              autoComplete="name"
              style={{
                borderColor: error ? "var(--accent-burgundy)" : undefined,
              }}
            />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  color: "var(--accent-burgundy)",
                  fontSize: "0.8rem",
                  marginTop: "0.4rem",
                  fontWeight: 500,
                }}
              >
                {error}
              </motion.p>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !name.trim()}
            style={{
              marginTop: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "14px 28px",
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{
                    repeat: Infinity,
                    duration: 1,
                    ease: "linear",
                  }}
                  style={{
                    display: "inline-block",
                    width: 16,
                    height: 16,
                    border: "2px solid white",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                  }}
                />
                Loading...
              </span>
            ) : (
              <>
                Start Learning <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.78rem",
            marginTop: "1.5rem",
            lineHeight: 1.5,
          }}
        >
          Your name will be displayed throughout the app.
          <br />
          No account or password needed.
        </p>
      </motion.div>
    </div>
  );
}
