"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AuthModal } from "@/components/auth-modal";

/**
 * Topbar slot for authentication. Shows nothing while auth is disabled or the
 * session is still loading (so the topbar never changes shape unexpectedly),
 * a 로그인 button for guests, and the user's email + logout for members.
 */
export function AuthMenu() {
  const { user, isLoading, isEnabled, signOut } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the dropdown when clicking anywhere outside of it.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  if (!isEnabled || isLoading) return null;
  if (!user) {
    return (
      <>
        <button className="btn btn-primary btn-small topbar-cta" type="button" onClick={() => setModalOpen(true)}>
          로그인
        </button>
        <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  // Anonymous guest users have no email; show an explicit 게스트 label instead
  // of an empty pill (their avatar initial also can't come from an email).
  const isAnonymous = user.is_anonymous === true;
  const emailLabel = isAnonymous ? "게스트" : (user.email ?? "내 계정");

  // Guests don't get the tiny logout dropdown (it renders as a mysterious
  // near-empty bar); clicking the pill opens the login dialog instead so they
  // can switch to a real account. Signed-in members keep the email dropdown.
  if (isAnonymous) {
    return (
      <>
        <button
          className="auth-menu-trigger"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={modalOpen}
          title="게스트로 이용 중 — 클릭하면 로그인 창이 열립니다"
          onClick={() => setModalOpen(true)}
        >
          <span className="auth-menu-avatar" aria-hidden="true">N</span>
          <span className="auth-menu-email">게스트</span>
        </button>
        <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <div className="auth-menu" ref={menuRef}>
      <button
        className="auth-menu-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="auth-menu-avatar" aria-hidden="true">{emailLabel.charAt(0).toUpperCase()}</span>
        <span className="auth-menu-email">{emailLabel}</span>
      </button>
      {menuOpen && (
        <div className="auth-menu-dropdown" role="menu">
          <button
            className="auth-menu-item"
            type="button"
            role="menuitem"
            onClick={async () => {
              setMenuOpen(false);
              await signOut();
            }}
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
