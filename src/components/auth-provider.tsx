"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { isSupabaseConfigured } from "@/lib/supabase-env";
import { toAuthEmail, validateLoginId } from "@/lib/username-auth";

type AuthState = {
  /** Signed-in Supabase user, or null when logged out / auth disabled. */
  user: User | null;
  /** True until the initial session lookup finishes (avoids UI flicker). */
  isLoading: boolean;
  /** False while Supabase env vars are unset — the app runs without login. */
  isEnabled: boolean;
  /** `loginId` is the 아이디 the user chose (an email keeps working). */
  signInWithPassword: (loginId: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (loginId: string, password: string) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  signInAsGuest: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

/**
 * If the current session is an anonymous guest, fetch a short-lived merge
 * token BEFORE the credentials replace the session. Returns null for normal
 * (non-guest) usage or on any failure — migration is best-effort.
 */
async function fetchGuestMergeToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user || data.user.is_anonymous !== true) return null;
    const res = await fetch("/api/auth/guest-token");
    if (!res.ok) return null;
    const json = (await res.json()) as { token?: string };
    return json.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Exchange the guest merge token for actual data migration now that the
 * password sign-in has completed. Never throws — migration is best-effort.
 */
async function redeemGuestMergeToken(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await fetch("/api/auth/merge-guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    // The answer data stays with the guest account; nothing to surface here.
  }
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Single source of truth for authentication state. Reads the existing Supabase
 * session on mount (so refreshes/browser restarts restore the session from the
 * auth cookies) and subscribes to onAuthStateChange for sign-in/out events.
 * When Supabase is not configured the provider passes a disabled state through
 * and the UI renders exactly as it did before auth existed.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const signInWithPassword = useCallback(async (loginId: string, password: string) => {
    const invalid = validateLoginId(loginId);
    if (invalid) return { error: invalid };
    const supabase = createSupabaseBrowserClient();
    // Grab the guest merge token while the anonymous session still exists.
    const mergeToken = await fetchGuestMergeToken();
    // 아이디 → credential address (see src/lib/username-auth.ts).
    const { error } = await supabase.auth.signInWithPassword({ email: toAuthEmail(loginId), password });
    if (error) return { error: translateAuthError(error.message) };
    await redeemGuestMergeToken(mergeToken);
    return { error: null };
  }, []);

  const signUpWithPassword = useCallback(async (loginId: string, password: string) => {
    const invalid = validateLoginId(loginId);
    if (invalid) return { error: invalid, needsEmailConfirm: false };
    const supabase = createSupabaseBrowserClient();
    // Grab the guest merge token while the anonymous session still exists.
    const mergeToken = await fetchGuestMergeToken();
    const { data, error } = await supabase.auth.signUp({ email: toAuthEmail(loginId), password });
    if (error) return { error: translateAuthError(error.message), needsEmailConfirm: false };
    // If email confirmation is on, the session is null until the user confirms.
    const needsEmailConfirm = !data.session;
    if (!needsEmailConfirm) await redeemGuestMergeToken(mergeToken);
    return { error: null, needsEmailConfirm };
  }, []);

  /** Supabase anonymous sign-in — creates a real session/user without credentials. */
  const signInAsGuest = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) return { error: translateAuthError(error.message) };
    // onAuthStateChange picks up the new session; the modal closes on success.
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, isLoading, isEnabled: isSupabaseConfigured(), signInWithPassword, signUpWithPassword, signInAsGuest, signOut }),
    [user, isLoading, signInWithPassword, signUpWithPassword, signInAsGuest, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "아이디 또는 비밀번호가 올바르지 않습니다.";
  if (/email not confirmed/i.test(message))
    return "이메일 확인 기능이 켜져 있어 로그인할 수 없습니다. Supabase → Authentication → Sign In / Providers에서 Confirm email을 꺼 주세요.";
  if (/already registered|already been registered|user already exists/i.test(message))
    return "이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.";
  if (/unable to validate email|invalid.*email/i.test(message))
    return "아이디는 영문 소문자·숫자·_·- 로 3~20자까지 사용할 수 있습니다.";
  if (/rate limit/i.test(message)) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  if (/password/i.test(message) && /at least|should be|least/i.test(message)) return "비밀번호는 6자 이상이어야 합니다.";
  if (/anonymous sign-ins? (are|is) disabled/i.test(message))
    return "게스트 로그인이 아직 활성화되지 않았습니다. Supabase 대시보드 → Authentication → Sign In / Providers에서 Anonymous sign-ins를 켜 주세요.";
  if (/signups not allowed|provider.*disabled|unsupported_provider/i.test(message))
    return "게스트 로그인이 아직 활성화되지 않았습니다. Supabase 대시보드에서 Anonymous sign-ins를 켜 주세요.";
  return "인증 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}
