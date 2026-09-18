"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, LogOut, RefreshCw, Zap } from "lucide-react";
import {
  StravaActivity,
  StravaAthlete,
  formatDistance,
  formatTime,
  formatElevation,
  formatPace,
  getSportEmoji,
  getSportColor,
  getWeekRange,
} from "@/lib/strava";

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatWeekLabel(start: Date, end: Date) {
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

function isToday(date: Date) {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isFuture(date: Date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date > now;
}

function ActivityCard({ activity, index }: { activity: StravaActivity; index: number }) {
  const color = getSportColor(activity.sport_type || activity.type);
  const emoji = getSportEmoji(activity.sport_type || activity.type);
  const pace = formatPace(activity.distance, activity.moving_time, activity.sport_type || activity.type);

  return (
    <div
      className="animate-fade-up"
      style={{
        animationDelay: `${index * 60}ms`,
        opacity: 0,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "10px 12px",
        borderLeft: `3px solid ${color}`,
        marginBottom: 6,
        transition: "transform 0.15s ease-out, box-shadow 0.15s ease-out",
        cursor: "default",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px rgba(0,0,0,0.3)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Sport + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{emoji}</span>
        <span style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 13,
          color: "var(--color-text-primary)",
          lineHeight: 1.2,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {activity.name}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
        {activity.distance > 0 && (
          <Stat label="DIST" value={formatDistance(activity.distance, activity.sport_type || activity.type)} />
        )}
        <Stat label="TIME" value={formatTime(activity.moving_time)} />
        {activity.total_elevation_gain > 5 && (
          <Stat label="ELEV" value={formatElevation(activity.total_elevation_gain)} />
        )}
        {pace && <Stat label="PACE" value={pace} />}
        {activity.average_heartrate && (
          <Stat label="HR" value={`${Math.round(activity.average_heartrate)}bpm`} color="#df2626" />
        )}
        {activity.suffer_score != null && activity.suffer_score > 0 && (
          <Stat label="SUFFER" value={activity.suffer_score.toString()} />
        )}
      </div>

      {/* Kudos / achievements */}
      {(activity.kudos_count > 0 || activity.achievement_count > 0) && (
        <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
          {activity.kudos_count > 0 && (
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-ui)" }}>
              👏 {activity.kudos_count}
            </span>
          )}
          {activity.achievement_count > 0 && (
            <span style={{ fontSize: 10, color: "#fdb999", fontFamily: "var(--font-ui)" }}>
              🏆 {activity.achievement_count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--color-text-dim)", fontFamily: "var(--font-ui)", fontWeight: 700, letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: color ?? "var(--color-text-primary)", fontFamily: "var(--font-ui)", fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

function DayColumn({
  dayIndex,
  date,
  activities,
}: {
  dayIndex: number;
  date: Date;
  activities: StravaActivity[];
}) {
  const today = isToday(date);
  const future = isFuture(date);
  const hasActivity = activities.length > 0;

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      {/* Day header */}
      <div style={{
        padding: "8px 4px",
        borderBottom: `2px solid ${today ? "var(--color-orange)" : "var(--color-border)"}`,
        marginBottom: 4,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.1em",
          color: today ? "var(--color-orange)" : future ? "var(--color-text-dim)" : "var(--color-text-muted)",
        }}>
          {DAY_LABELS[dayIndex]}
        </div>
        <div style={{
          fontFamily: "var(--font-display)",
          fontWeight: today ? 700 : 400,
          fontSize: today ? 22 : 18,
          color: today ? "var(--color-text-primary)" : future ? "var(--color-text-dim)" : "var(--color-text-muted)",
          lineHeight: 1.1,
          marginTop: 2,
        }}>
          {date.getDate()}
        </div>
      </div>

      {/* Activities */}
      {hasActivity ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {activities.map((a, i) => (
            <ActivityCard key={a.id} activity={a} index={i} />
          ))}
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 4px",
        }}>
          {!future && (
            <span style={{
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              color: "var(--color-text-dim)",
              letterSpacing: "0.06em",
            }}>
              REST
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function WeekSummary({ activities }: { activities: StravaActivity[] }) {
  const totalDist = activities.reduce((s, a) => s + a.distance, 0);
  const totalTime = activities.reduce((s, a) => s + a.moving_time, 0);
  const totalElev = activities.reduce((s, a) => s + a.total_elevation_gain, 0);
  const activeDays = new Set(activities.map(a => a.start_date_local.slice(0, 10))).size;

  const sports: Record<string, number> = {};
  activities.forEach(a => {
    const t = a.sport_type || a.type;
    sports[t] = (sports[t] ?? 0) + 1;
  });

  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 8,
      padding: "14px 20px",
      display: "flex",
      gap: 32,
      alignItems: "center",
      flexWrap: "wrap",
    }}>
      <SummaryItem label="ACTIVITIES" value={activities.length.toString()} accent />
      <SummaryItem label="ACTIVE DAYS" value={activeDays.toString()} />
      {totalDist > 0 && <SummaryItem label="TOTAL DIST" value={`${(totalDist / 1000).toFixed(1)}km`} />}
      <SummaryItem label="TOTAL TIME" value={formatTime(totalTime)} />
      {totalElev > 0 && <SummaryItem label="ELEVATION" value={`${Math.round(totalElev)}m`} />}
      {Object.entries(sports).map(([type, count]) => (
        <SummaryItem key={type} label={type.toUpperCase()} value={`${getSportEmoji(type)} ×${count}`} />
      ))}
    </div>
  );
}

function SummaryItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--color-text-dim)", fontFamily: "var(--font-ui)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, color: accent ? "var(--color-orange)" : "var(--color-text-primary)", fontFamily: "var(--font-display)", fontWeight: 700, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function LoginScreen({ error }: { error: string | null }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 32,
      padding: 24,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M24 4L30 20H44L32 30L36 46L24 36L12 46L16 30L4 20H18L24 4Z" fill="#fc5200" />
        </svg>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 36, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
          STRAVA WEEK
        </div>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--color-text-muted)", letterSpacing: "0.08em" }}>
          YOUR PERSONAL ACTIVITY CALENDAR
        </div>
      </div>

      {error && (
        <div style={{
          background: "rgba(223,38,38,0.12)",
          border: "1px solid #df2626",
          borderRadius: 8,
          padding: "10px 16px",
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          color: "#df2626",
        }}>
          {error === "denied" ? "Authorization was denied. Please try again." : "Something went wrong. Please try again."}
        </div>
      )}

      <a href="/api/auth" style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--color-orange)",
        color: "white",
        textDecoration: "none",
        padding: "14px 28px",
        borderRadius: 8,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: "0.04em",
        transition: "opacity 0.15s ease-out",
      }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
      >
        <Zap size={18} />
        CONNECT WITH STRAVA
      </a>

      <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.05em", maxWidth: 320, textAlign: "center" }}>
        READS YOUR ACTIVITIES ONLY · NO WRITES · TOKENS STORED IN A SECURE HTTP-ONLY COOKIE
      </p>
    </div>
  );
}

export default function Home() {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [error, setError] = useState<string | null>(null);

  const targetDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  })();

  const { start: weekStart, end: weekEnd } = getWeekRange(targetDate);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/activities?week=${targetDate.toISOString()}`);
      if (res.status === 401) { setAuthed(false); setLoading(false); return; }
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setActivities(data.activities);
      setAthlete(data.athlete);
      setAuthed(true);
    } catch {
      setError("Failed to load activities.");
    } finally {
      setLoading(false);
    }
  }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadActivities(); }, [loadActivities]);

  // Check for error param from OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("error");
    if (e) setError(e);
  }, []);

  if (authed === false) return <LoginScreen error={error} />;

  // Build 7-day columns
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const activitiesByDay: Record<string, StravaActivity[]> = {};
  activities.forEach(a => {
    const key = a.start_date_local.slice(0, 10);
    if (!activitiesByDay[key]) activitiesByDay[key] = [];
    activitiesByDay[key].push(a);
  });

  const isCurrentWeek = weekOffset === 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", padding: "0 0 48px" }}>
      {/* Top nav */}
      <nav style={{
        borderBottom: "1px solid var(--color-border)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L30 20H44L32 30L36 46L24 36L12 46L16 30L4 20H18L24 4Z" fill="#fc5200" />
          </svg>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--color-text-primary)", letterSpacing: "0.02em" }}>
            STRAVA WEEK
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {athlete && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {athlete.profile_medium && (
                <img
                  src={athlete.profile_medium}
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--color-border)" }}
                />
              )}
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--color-text-muted)" }}>
                {athlete.firstname} {athlete.lastname}
              </span>
            </div>
          )}
          <button
            onClick={loadActivities}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-dim)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              transition: "color 0.15s",
            }}
            title="Refresh"
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-primary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-dim)")}
          >
            <RefreshCw size={15} className={loading ? "animate-pulse" : ""} />
          </button>
          <a
            href="/api/auth/logout"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: "var(--color-text-dim)",
              textDecoration: "none",
              letterSpacing: "0.06em",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-primary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-dim)")}
          >
            <LogOut size={13} />
            SIGN OUT
          </a>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
        {/* Week header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                borderRadius: 6,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-orange)")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)")}
            >
              <ChevronLeft size={16} />
            </button>

            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--color-text-primary)", lineHeight: 1.1 }}>
                {isCurrentWeek ? "THIS WEEK" : formatWeekLabel(weekStart, weekEnd).toUpperCase()}
              </div>
              {isCurrentWeek && (
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                  {formatWeekLabel(weekStart, weekEnd)}
                </div>
              )}
            </div>

            <button
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset >= 0}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: weekOffset >= 0 ? "var(--color-text-dim)" : "var(--color-text-primary)",
                borderRadius: 6,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: weekOffset >= 0 ? "default" : "pointer",
                opacity: weekOffset >= 0 ? 0.4 : 1,
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => { if (weekOffset < 0) (e.currentTarget as HTMLElement).style.borderColor = "var(--color-orange)"; }}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)")}
            >
              <ChevronRight size={16} />
            </button>

            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-orange)",
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontFamily: "var(--font-ui)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-orange)")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)")}
              >
                TODAY
              </button>
            )}
          </div>

          <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.06em" }}>
            {loading ? "LOADING..." : `${activities.length} ACTIVIT${activities.length !== 1 ? "IES" : "Y"}`}
          </div>
        </div>

        {/* Weekly summary */}
        {!loading && activities.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <WeekSummary activities={activities} />
          </div>
        )}

        {/* Calendar grid */}
        {loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 8,
            minHeight: 300,
          }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{
                background: "var(--color-surface)",
                borderRadius: 8,
                height: 200,
                border: "1px solid var(--color-border)",
                animation: "pulse 2s ease-in-out infinite",
                animationDelay: `${i * 100}ms`,
              }} />
            ))}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 8,
            alignItems: "start",
          }}>
            {days.map((date, i) => {
              const key = date.toISOString().slice(0, 10);
              return (
                <DayColumn
                  key={key}
                  dayIndex={i}
                  date={date}
                  activities={activitiesByDay[key] ?? []}
                />
              );
            })}
          </div>
        )}

        {!loading && activities.length === 0 && authed && (
          <div style={{
            textAlign: "center",
            padding: "60px 0",
            color: "var(--color-text-dim)",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            letterSpacing: "0.06em",
          }}>
            NO ACTIVITIES THIS WEEK — REST UP 💤
          </div>
        )}
      </div>
    </div>
  );
}
