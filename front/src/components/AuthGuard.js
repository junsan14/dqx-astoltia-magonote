"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/auth";
import { isAdminPath } from "@/lib/adminPaths";

export default function AuthGuard({ children }) {
  const pathname = usePathname();

  if (!isAdminPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <ProtectedAuthGuard pathname={pathname}>
      {children}
    </ProtectedAuthGuard>
  );
}

function ProtectedAuthGuard({ children, pathname }) {
  const router = useRouter();
  const { user } = useAuth();

  const loginUrl = useMemo(() => {
    return `/login?redirect=${encodeURIComponent(pathname || "/")}`;
  }, [pathname]);

  useEffect(() => {
    if (user === null) {
      router.replace(loginUrl);
    }
  }, [user, router, loginUrl]);

  if (user === undefined) {
    return <LoadingScreen text="ユーザー情報を確認しています" />;
  }

  if (user === null) {
    return (
      <LoadingScreen
        text="ログインページへ移動しています"
        loginUrl={loginUrl}
      />
    );
  }

  const isAdmin = Boolean(user?.is_admin);

  if (!isAdmin) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <p style={styles.text}>このページにアクセスする権限がありません。</p>

          <div style={styles.actions}>
            <Link href="/" style={styles.link}>
              トップへ戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function LoadingScreen({ text, loginUrl }) {
  return (
    <div style={styles.loadingWrapper}>
      <div style={styles.loadingCard}>
        <div style={styles.spinnerWrap}>
          <span style={{ ...styles.dot, animationDelay: "0s" }} />
          <span style={{ ...styles.dot, animationDelay: "0.15s" }} />
          <span style={{ ...styles.dot, animationDelay: "0.3s" }} />
        </div>

        <h1 style={styles.loadingTitle}>Loading...</h1>
        <p style={styles.loadingText}>{text}</p>

        {loginUrl ? (
          <div style={styles.actions}>
            <Link href={loginUrl} style={styles.link}>
              ログインページへ
            </Link>
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes guardBounce {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.45;
          }
          40% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  loadingWrapper: {
    minHeight: "calc(100vh - 140px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px",
    background:
      "linear-gradient(180deg, var(--page-bg) 0%, var(--soft-bg) 100%)",
  },
  loadingCard: {
    width: "100%",
    maxWidth: "480px",
    borderRadius: "20px",
    padding: "40px 28px",
    background: "color-mix(in srgb, var(--card-bg) 90%, transparent)",
    border: "1px solid var(--card-border)",
    boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
    textAlign: "center",
  },
  spinnerWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px",
    marginBottom: "20px",
  },
  dot: {
    width: "12px",
    height: "12px",
    borderRadius: "9999px",
    background: "var(--secondary-text)",
    display: "inline-block",
    animation: "guardBounce 1.2s infinite ease-in-out",
  },
  loadingTitle: {
    margin: "0 0 10px",
    fontSize: "24px",
    fontWeight: 800,
    color: "var(--text-title)",
    letterSpacing: "0.02em",
  },
  loadingText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.7,
    color: "var(--text-sub)",
  },
  wrapper: {
    minHeight: "calc(100vh - 140px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "var(--page-bg)",
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: "12px",
    padding: "24px",
    color: "var(--text-main)",
    boxSizing: "border-box",
  },
  text: {
    margin: 0,
    color: "var(--text-sub)",
    lineHeight: 1.7,
  },
  actions: {
    marginTop: "20px",
  },
  link: {
    display: "inline-block",
    padding: "10px 14px",
    borderRadius: "8px",
    background: "var(--secondary-bg)",
    color: "var(--secondary-text)",
    border: "1px solid var(--secondary-border)",
    textDecoration: "none",
    fontWeight: 700,
  },
};