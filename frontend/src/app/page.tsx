"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Brain,
  Upload,
  FileQuestion,
  Layers,
  MessageCircle,
  Calculator,
  CheckSquare,
  Sparkles,
  ArrowRight,
  BookOpen,
  Feather,
  GraduationCap,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const features = [
  {
    icon: Upload,
    title: "Upload Any Material",
    desc: "PDF, PPT, Word, or plain text — submit your readings and let AI distill the essence instantly.",
    color: "#c87a2a",
  },
  {
    icon: FileQuestion,
    title: "Quiz Generator",
    desc: "Auto-generate thoughtful multiple-choice assessments drawn from your course material.",
    color: "#2c3e6b",
  },
  {
    icon: Layers,
    title: "Smart Flashcards",
    desc: "Elegant flip cards synthesized from key concepts — perfect for spaced repetition study.",
    color: "#2d7a5f",
  },
  {
    icon: MessageCircle,
    title: "AI Chat Tutor",
    desc: "Converse with an AI tutor who has read your documents and answers with scholarly precision.",
    color: "#c87a2a",
  },
  {
    icon: Calculator,
    title: "Math Solver",
    desc: "Step-by-step solutions presented with clarity — from calculus to linear algebra.",
    color: "#2d7a5f",
  },
  {
    icon: CheckSquare,
    title: "Study Tasks",
    desc: "Personalized learning assignments crafted by AI to guide your mastery of the material.",
    color: "#2c3e6b",
  },
];

export default function LandingPage() {
  return (
    <div style={{ overflow: "hidden", background: "#faf7f2", color: "#2c2c2c", minHeight: "100vh" }}>
      {/* Floating Orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "14px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(250, 247, 242, 0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(200, 122, 42, 0.12)",
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #c87a2a, #2d7a5f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Brain size={20} color="white" />
          </div>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: "'Playfair Display', serif",
              color: "#2c3e6b",
            }}
          >
            StudentAI
          </span>
        </Link>

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/login" className="btn-secondary" style={{ padding: "9px 22px" }}>
            Sign In
          </Link>
          <Link href="/register" className="btn-primary" style={{ padding: "9px 22px" }}>
            Get Started <ArrowRight size={15} />
          </Link>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "140px 24px 80px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" style={{ marginBottom: 20 }}>
          <span className="badge badge-orange" style={{ fontSize: 12, padding: "7px 16px" }}>
            <Feather size={13} /> A Scholarly Approach to Learning
          </span>
        </motion.div>

        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{
            fontSize: "clamp(2.5rem, 5.5vw, 4.4rem)",
            fontWeight: 700,
            lineHeight: 1.12,
            maxWidth: 820,
            marginBottom: 24,
            fontFamily: "'Playfair Display', serif",
            letterSpacing: "-0.01em",
            color: "#2c3e6b",
          }}
        >
          Where Curiosity Meets{" "}
          <span className="gradient-text" style={{ fontStyle: "italic" }}>Intelligent</span>{" "}
          Study
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{
            fontSize: "clamp(1rem, 1.8vw, 1.18rem)",
            color: "#5c5c5c",
            maxWidth: 580,
            lineHeight: 1.75,
            marginBottom: 40,
            fontFamily: "'Source Sans 3', sans-serif",
          }}
        >
          Upload your readings, lecture notes, or textbooks — and let AI craft quizzes,
          flashcards, and guided study paths tailored to your understanding.
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}
        >
          <Link href="/register" className="btn-primary" style={{ padding: "14px 34px", fontSize: 15 }}>
            <Sparkles size={17} /> Begin Your Journey
          </Link>
          <Link href="/login" className="btn-secondary" style={{ padding: "14px 34px", fontSize: 15 }}>
            <BookOpen size={17} /> I Have an Account
          </Link>
        </motion.div>

        {/* Ornamental Divider */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{ marginTop: 56 }}
        >
          <div className="divider-ornament" />
        </motion.div>
      </section>

      {/* Features Grid */}
      <section
        style={{
          padding: "60px 24px 100px",
          maxWidth: 1100,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: 56 }}
        >
          <span className="badge badge-green" style={{ marginBottom: 14, display: "inline-flex" }}>
            <GraduationCap size={13} /> Tools for the Devoted Learner
          </span>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
              fontWeight: 700,
              marginTop: 14,
              fontFamily: "'Playfair Display', serif",
              color: "#2c3e6b",
            }}
          >
            Everything You Need to{" "}
            <span className="gradient-text-secondary">Master Your Studies</span>
          </h2>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
            gap: 20,
          }}
        >
          {features.map((feat, i) => (
            <motion.div
              key={feat.title}
              className="glass-card"
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              style={{ padding: 30, cursor: "default" }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  background: `${feat.color}12`,
                  border: `1.5px solid ${feat.color}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                }}
              >
                <feat.icon size={23} color={feat.color} />
              </div>
              <h3
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  marginBottom: 9,
                  fontFamily: "'Playfair Display', serif",
                  color: "#2c3e6b",
                }}
              >
                {feat.title}
              </h3>
              <p style={{ color: "#5c5c5c", lineHeight: 1.75, fontSize: 14, fontFamily: "'Source Sans 3', sans-serif" }}>
                {feat.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section
        style={{
          padding: "60px 24px 80px",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="glass-card"
          style={{
            maxWidth: 680,
            margin: "0 auto",
            padding: "56px 40px",
            textAlign: "center",
            background: "linear-gradient(135deg, rgba(200, 122, 42, 0.06), rgba(45, 122, 95, 0.04))",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(1.6rem, 2.8vw, 2.3rem)",
              fontWeight: 700,
              marginBottom: 16,
              fontFamily: "'Playfair Display', serif",
              color: "#2c3e6b",
            }}
          >
            Ready to <span className="gradient-text-accent">Elevate</span> Your Learning?
          </h2>
          <p style={{ color: "#5c5c5c", marginBottom: 30, fontSize: 15, fontFamily: "'Source Sans 3', sans-serif", lineHeight: 1.7 }}>
            Join a community of dedicated students who study with intention, guided by AI that understands their material.
          </p>
          <Link href="/register" className="btn-primary" style={{ padding: "14px 38px", fontSize: 15 }}>
            <Sparkles size={17} /> Get Started — It&apos;s Free
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "32px 24px",
          textAlign: "center",
          color: "#8c8c8c",
          fontSize: 13,
          borderTop: "1px solid rgba(200, 122, 42, 0.12)",
          position: "relative",
          zIndex: 1,
          fontFamily: "'Source Sans 3', sans-serif",
        }}
      >
        StudentAI — Crafted for the curious mind.
      </footer>
    </div>
  );
}
