"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth-provider";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Minimal login/registration dialog rendered above the existing page. Uses the
 * site's own design-system classes (.modal/.btn/.field styles in globals.css)
 * so it visually belongs to the existing UI rather than a generic template.
 */
export function AuthModal({ open, onClose }: AuthModalProps) {
  const { signInWithPassword, signUpWithPassword, signInAsGuest } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // 비밀번호 is visible by default; checking the box hides it (per user request).
  const [showPassword, setShowPassword] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setMode("login");
      setEmail("");
      setPassword("");
      setShowPassword(true);
      setError(null);
      setInfo(null);
      setIsGuestSubmitting(false);
    }
  }, [open]);

  // Close on Escape so the dialog never traps the keyboard.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Render through a portal to document.body: the topbar (this modal's usual
  // mount point) uses clip-path for its full-bleed white band, and clip-path
  // would also clip this fixed-position overlay down to the 64px bar. Outside
  // the topbar the overlay covers the whole viewport as intended.
  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        const { error: signInError } = await signInWithPassword(email.trim(), password);
        if (signInError) {
          setError(signInError);
          return;
        }
        onClose();
      } else {
        const { error: signUpError, needsEmailConfirm } = await signUpWithPassword(email.trim(), password);
        if (signUpError) {
          setError(signUpError);
          return;
        }
        if (needsEmailConfirm) {
          setInfo("가입 완료! 이메일로 보내드린 인증 링크를 확인한 후 로그인해 주세요.");
          setMode("login");
        } else {
          onClose();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGuestSignIn() {
    if (isGuestSubmitting) return;
    setError(null);
    setInfo(null);
    setIsGuestSubmitting(true);
    try {
      const { error: guestError } = await signInAsGuest();
      if (guestError) {
        setError(guestError);
        return;
      }
      // onAuthStateChange updates the provider; close the dialog immediately.
      onClose();
    } finally {
      setIsGuestSubmitting(false);
    }
  }

  return createPortal(
    <div className="auth-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "login" ? "로그인" : "회원가입"}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="auth-modal-close" type="button" aria-label="닫기" onClick={onClose}>×</button>

        <p className="eyebrow">PDF2Exam 계정</p>
        <h2>{mode === "login" ? "로그인" : "회원가입"}</h2>
        <p className="auth-modal-sub">
          {mode === "login"
            ? "내 문제은행과 학습 기록을 그대로 불러옵니다."
            : "아이디(이메일)와 비밀번호만으로 계정을 만들 수 있습니다."}
        </p>

        <form onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>아이디</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="auth-field">
            <span>비밀번호</span>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "login" ? "비밀번호" : "6자 이상"}
            />
          </label>
          <label className="auth-show-password">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            <span>비밀번호 숨기기</span>
          </label>

          {error && <p className="upload-error" role="alert">{error}</p>}
          {info && <p className="upload-success">{info}</p>}

          <button className="btn btn-primary btn-block" disabled={isSubmitting} type="submit">
            {isSubmitting ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        <button
          className="auth-modal-switch"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>

        <div className="auth-modal-divider" role="separator" aria-label="또는">
          <span>또는</span>
        </div>

        <button
          className="btn btn-secondary btn-block"
          type="button"
          disabled={isGuestSubmitting}
          onClick={handleGuestSignIn}
        >
          {isGuestSubmitting ? "처리 중..." : "게스트로 계속하기"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
