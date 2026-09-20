"use client";
import { useState } from "react";
import { Zap, ExternalLink, ArrowRight, CheckCircle } from "lucide-react";

export default function AddProfilePage() {
  const [stravaSignedOut, setStravaSignedOut] = useState(false);

  const openStravaSignOut = () => {
    window.open("https://www.strava.com/athletes/sign_out", "_blank", "width=500,height=600,noopener");
    setStravaSignedOut(true);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--color-bg)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 32, padding: 24,
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Zap size={36} style={{ color: "var(--color-orange)" }} />
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, color: "var(--color-text-primary)", margin: 0 }}>
          ADD A NEW PROFILE
        </h1>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--color-text-muted)", letterSpacing: "0.06em", margin: 0 }}>
          TWO STEPS TO CONNECT A SECOND STRAVA ACCOUNT
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 420 }}>
        {/* Step 1 */}
        <div style={{
          background: "var(--color-surface)", border: `1px solid ${stravaSignedOut ? "var(--color-orange)" : "var(--color-border)"}`,
          borderRadius: 10, padding: "20px 24px",
          display: "flex", alignItems: "flex-start", gap: 16,
          transition: "border-color 0.2s",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: stravaSignedOut ? "var(--color-orange)" : "var(--color-surface-2)",
            border: `2px solid ${stravaSignedOut ? "var(--color-orange)" : "var(--color-border)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13,
            color: stravaSignedOut ? "white" : "var(--color-text-muted)",
            transition: "all 0.2s",
          }}>
            {stravaSignedOut ? <CheckCircle size={16} /> : "1"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)", marginBottom: 4 }}>
              Sign out of Strava
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: 12 }}>
              Strava doesn&apos;t show an account switcher on their OAuth page. Sign out first so you can log in as your second account.
            </div>
            <button
              onClick={openStravaSignOut}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: stravaSignedOut ? "transparent" : "var(--color-surface-2)",
                border: `1px solid ${stravaSignedOut ? "var(--color-border)" : "var(--color-border-subtle)"}`,
                borderRadius: 6, padding: "7px 14px", cursor: "pointer",
                fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 700,
                letterSpacing: "0.04em",
                color: stravaSignedOut ? "var(--color-text-dim)" : "var(--color-text-primary)",
              }}
            >
              <ExternalLink size={12} />
              {stravaSignedOut ? "DONE — SIGNED OUT" : "OPEN STRAVA SIGN OUT"}
            </button>
          </div>
        </div>

        {/* Step 2 */}
        <div style={{
          background: "var(--color-surface)", border: `1px solid ${stravaSignedOut ? "var(--color-border-subtle)" : "var(--color-border)"}`,
          borderRadius: 10, padding: "20px 24px",
          display: "flex", alignItems: "flex-start", gap: 16,
          opacity: stravaSignedOut ? 1 : 0.45,
          transition: "opacity 0.3s, border-color 0.2s",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: "var(--color-surface-2)",
            border: "2px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13,
            color: "var(--color-text-muted)",
          }}>
            2
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)", marginBottom: 4 }}>
              Connect your second account
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: 12 }}>
              Strava will show a fresh login page. Sign in as your second account and authorize the app.
            </div>
            <a
              href="/api/auth?n=2"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: stravaSignedOut ? "var(--color-orange)" : "var(--color-surface-2)",
                border: "none", borderRadius: 6, padding: "9px 18px",
                cursor: stravaSignedOut ? "pointer" : "default",
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14,
                letterSpacing: "0.04em", color: "white", textDecoration: "none",
                pointerEvents: stravaSignedOut ? "auto" : "none",
                transition: "background 0.2s",
              }}
            >
              CONNECT WITH STRAVA
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>

      <a
        href="/"
        style={{
          fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-dim)",
          letterSpacing: "0.06em", textDecoration: "none",
        }}
      >
        CANCEL — GO BACK
      </a>
    </div>
  );
}
