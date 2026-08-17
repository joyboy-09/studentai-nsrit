import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "StudentAI — Your AI-Powered Learning Companion",
  description:
    "Upload study materials and let AI generate quizzes, flashcards, tasks, and answer your questions. The smartest way to learn.",
  keywords: ["AI tutor", "study", "quiz generator", "flashcards", "student", "learning"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="bg-mesh" />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#ffffff",
              color: "#1a1814",
              border: "1px solid rgba(26, 24, 20, 0.1)",
              boxShadow: "0 4px 16px rgba(26, 24, 20, 0.08)",
              borderRadius: "10px",
              fontSize: "14px",
              fontFamily: "'Source Sans 3', sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
