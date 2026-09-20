"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, User, Settings, Bike, TrendingUp, X, Zap } from "lucide-react";
import {
  StravaActivity,
  StravaAthlete,
  AthleteStats,
  SummaryGear,
  formatDistance,
  formatTime,
  formatElevation,
  formatPace,
  getSportEmoji,
  getSportColor,
  getGearEmoji,
  inferredGearLabel,
  getWeekRange,
  calculateWeeklyStrain,
  strainLabel,
  generateSuggestions,
  decodePolyline,
  pointsToSvgPath,
} from "@/lib/strava";

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function formatWeekLabel(start: Date, end: Date) {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en", opts).format(d);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${fmt(start, { month: "short" })} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${fmt(start, { month: "short" })} – ${end.getDate()} ${fmt(end, { month: "short" })} ${end.getFullYear()}`;
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

const prefersReducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

/* ── Panel sheet ──────────────────────────────────────────────────── */
function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300 }} />
      <div
        role="dialog"
        aria-label={title}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 320,
          background: "var(--color-bg)", borderLeft: "1px solid var(--color-border)",
          zIndex: 301, display: "flex", flexDirection: "column",
          animation: "slideInRight 0.2s cubic-bezier(0,1.085,0.4,1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.04em", color: "var(--color-text-primary)" }}>
            {title}
          </span>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--color-text-dim)", cursor: "pointer", display: "flex", padding: 4 }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {children}
        </div>
      </div>
    </>
  );
}

/* ── Panel section heading ────────────────────────────────────────── */
function PanelSection({ label }: { label: string }) {
  return (
    <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--color-text-dim)", marginTop: 20, marginBottom: 8 }}>
      {label}
    </div>
  );
}

function PanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

/* ── Profile panel ────────────────────────────────────────────────── */
function ProfilePanel({ athlete }: { athlete: StravaAthlete }) {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingBottom: 20, borderBottom: "1px solid var(--color-border)", marginBottom: 4 }}>
        {athlete.profile_medium && (
          <img src={athlete.profile_medium} alt="" width={72} height={72} style={{ borderRadius: "50%", border: "3px solid var(--color-border)" }} />
        )}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "var(--color-text-primary)" }}>
            {athlete.firstname} {athlete.lastname}
          </div>
          {(athlete.city || athlete.country) && (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
              {[athlete.city, athlete.country].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </div>
      {(athlete.follower_count != null || athlete.friend_count != null) && (
        <>
          <PanelSection label="CONNECTIONS" />
          {athlete.friend_count != null && <PanelRow label="Following" value={athlete.friend_count.toLocaleString("en")} />}
          {athlete.follower_count != null && <PanelRow label="Followers" value={athlete.follower_count.toLocaleString("en")} />}
        </>
      )}
    </div>
  );
}

/* ── Settings panel ───────────────────────────────────────────────── */
function SettingsPanel({ athlete }: { athlete: StravaAthlete }) {
  return (
    <div>
      <PanelSection label="APP" />
      <PanelRow label="Name" value="Strava Week" />
      <PanelRow label="Version" value="1.0" />
      <PanelSection label="ACCOUNT" />
      <PanelRow label="Athlete" value={`${athlete.firstname} ${athlete.lastname}`} />
      <PanelRow label="ID" value={String(athlete.id)} />
      <PanelSection label="PERMISSIONS" />
      <PanelRow label="Activities" value="Read all" />
      <PanelRow label="Profile" value="Read all" />
      <PanelRow label="Writes" value="None" />
    </div>
  );
}

/* ── Bike garage panel ────────────────────────────────────────────── */
function bikeEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("mountain") || n.includes("mtb") || n.includes("trail") || n.includes("enduro")) return "🚵";
  if (n.includes("gravel") || n.includes("cx") || n.includes("cyclocross")) return "🚵";
  if (n.includes("e-bike") || n.includes("ebike") || n.includes("electric")) return "⚡";
  return "🚴";
}

function BikeGaragePanel({ bikes }: { bikes: SummaryGear[] }) {
  if (bikes.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-dim)", letterSpacing: "0.06em" }}>
        NO BIKES FOUND — ADD THEM IN STRAVA SETTINGS
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {bikes.map(bike => (
        <div
          key={bike.id}
          style={{
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: 8, padding: "14px 16px",
            boxShadow: "inset 0 3px 5px rgba(0,0,0,.125)",
            display: "flex", alignItems: "center", gap: 14,
          }}
        >
          <span style={{ fontSize: 28, flexShrink: 0 }} aria-hidden="true">{bikeEmoji(bike.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {bike.name}
              </span>
              {bike.primary && (
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-orange)", border: "1px solid var(--color-orange)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>
                  PRIMARY
                </span>
              )}
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
              {new Intl.NumberFormat("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(bike.distance / 1000)} km total
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Progress panel ───────────────────────────────────────────────── */
function StatBlock({ label, totals }: { label: string; totals: { count: number; distance: number; moving_time: number; elevation_gain: number } }) {
  if (totals.count === 0) return null;
  return (
    <>
      <PanelSection label={label} />
      <PanelRow label="Activities" value={totals.count.toLocaleString("en")} />
      {totals.distance > 0 && (
        <PanelRow label="Distance" value={`${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(totals.distance / 1000)} km`} />
      )}
      <PanelRow label="Moving Time" value={formatTime(totals.moving_time)} />
      {totals.elevation_gain > 0 && (
        <PanelRow label="Elevation" value={`${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(totals.elevation_gain)} m`} />
      )}
    </>
  );
}

function ProgressPanel() {
  const [stats, setStats] = useState<AthleteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const year = new Date().getFullYear();

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-dim)", letterSpacing: "0.06em" }}>LOADING…</div>;
  }
  if (!stats) {
    return <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-dim)" }}>Failed to load stats.</div>;
  }

  const ytdRide  = stats.ytd_ride_totals;
  const ytdRun   = stats.ytd_run_totals;
  const ytdSwim  = stats.ytd_swim_totals;
  const allRide  = stats.all_ride_totals;
  const allRun   = stats.all_run_totals;

  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--color-text-muted)", letterSpacing: "0.06em", marginBottom: 4 }}>
        {year} SEASON
      </div>
      <StatBlock label="🚴 RIDES" totals={ytdRide} />
      <StatBlock label="🏃 RUNS" totals={ytdRun} />
      <StatBlock label="🏊 SWIMS" totals={ytdSwim} />

      {(allRide.count > 0 || allRun.count > 0) && (
        <>
          <div style={{ margin: "24px 0 0", borderTop: "1px solid var(--color-border)", paddingTop: 16, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--color-text-muted)", letterSpacing: "0.06em" }}>
            ALL TIME
          </div>
          <StatBlock label="🚴 RIDES" totals={allRide} />
          <StatBlock label="🏃 RUNS" totals={allRun} />
        </>
      )}
    </div>
  );
}

/* ── Profile dropdown menu ────────────────────────────────────────── */
type PanelId = "profile" | "settings" | "garage" | "progress";

function ProfileMenu({ athlete, onOpen }: { athlete: StravaAthlete; onOpen: (id: PanelId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items: { id: PanelId; icon: React.ReactNode; label: string }[] = [
    { id: "profile",  icon: <User size={14} aria-hidden="true" />,       label: "Profile" },
    { id: "settings", icon: <Settings size={14} aria-hidden="true" />,   label: "Settings" },
    { id: "garage",   icon: <Bike size={14} aria-hidden="true" />,       label: "Bike Garage" },
    { id: "progress", icon: <TrendingUp size={14} aria-hidden="true" />, label: "Progress" },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px",
          borderRadius: 8, minWidth: 0,
        }}
      >
        {athlete.profile_medium && (
          <img
            src={athlete.profile_medium}
            alt={`${athlete.firstname} ${athlete.lastname}`}
            width={28} height={28}
            style={{ borderRadius: "50%", border: "2px solid var(--color-border)", flexShrink: 0 }}
          />
        )}
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, maxWidth: 120 }}>
          {athlete.firstname} {athlete.lastname}
        </span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          style={{ color: "var(--color-text-dim)", flexShrink: 0, transition: "transform 0.15s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: 8, padding: 4, minWidth: 180,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 200,
            animation: "fadeUp 0.15s ease-out forwards",
          }}
        >
          {items.map(item => (
            <button
              key={item.id}
              role="menuitem"
              onClick={() => { setOpen(false); onOpen(item.id); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 12px", background: "transparent", border: "none",
                borderRadius: 6, cursor: "pointer", textAlign: "left",
                color: "var(--color-text-primary)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: "var(--color-text-muted)" }}>{item.icon}</span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>
                {item.label}
              </span>
            </button>
          ))}

          <div style={{ borderTop: "1px solid var(--color-border)", margin: "4px 0" }} />
          <a
            href="/api/auth/logout"
            role="menuitem"
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "9px 12px", background: "transparent",
              borderRadius: 6, cursor: "pointer", textDecoration: "none",
              color: "var(--color-text-dim)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, letterSpacing: "0.04em" }}>Sign Out</span>
          </a>
        </div>
      )}
    </div>
  );
}

/* ── Logo ─────────────────────────────────────────────────────────── */
function StravaIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* Two-chevron "S" mark approximating the Strava logomark */}
      <path d="M20 4H32L44 26H30L20 4Z" fill="#fc5200" />
      <path d="M16 26H30L22 44H10L16 26Z" fill="#fc5200" />
    </svg>
  );
}

/* ── Route background ─────────────────────────────────────────────── */
function RouteBackground({ polyline, color }: { polyline: string; color: string }) {
  const points = decodePolyline(polyline);
  const path = pointsToSvgPath(points, 300, 180, 12);
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 300 180"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.28 }}
    >
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Activity card ────────────────────────────────────────────────── */
function ActivityCard({ activity, index, gear }: { activity: StravaActivity; index: number; gear?: SummaryGear }) {
  const color = getSportColor(activity.sport_type || activity.type);
  const emoji = getSportEmoji(activity.sport_type || activity.type);
  const pace = formatPace(activity.distance, activity.moving_time, activity.sport_type || activity.type);

  return (
    <div
      className="activity-card animate-fade-up"
      style={{
        animationDelay: `${index * 60}ms`,
        opacity: 0,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 6,
        position: "relative",
        overflow: "hidden",
        boxShadow: "inset 0 3px 5px rgba(0,0,0,.125)",
      }}
    >
      {/* Colored left accent — clipped by overflow:hidden so it respects border-radius */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: color }} />

      {activity.map?.summary_polyline && (
        <RouteBackground polyline={activity.map.summary_polyline} color={color} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span aria-hidden="true" style={{ fontSize: 14 }}>{emoji}</span>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13,
          color: "var(--color-text-primary)", lineHeight: 1.2,
          flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {activity.name}
        </span>
      </div>

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

      {(activity.kudos_count > 0 || activity.achievement_count > 0 || gear) && (
        <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
          {activity.kudos_count > 0 && (
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-ui)" }}>
              <span aria-hidden="true">👏</span> {activity.kudos_count}
            </span>
          )}
          {activity.achievement_count > 0 && (
            <span style={{ fontSize: 10, color: "#fdb999", fontFamily: "var(--font-ui)" }}>
              <span aria-hidden="true">🏆</span> {activity.achievement_count}
            </span>
          )}
          {(() => {
            const sportType = activity.sport_type || activity.type;
            const label = gear
              ? { emoji: getGearEmoji(sportType), name: gear.name }
              : inferredGearLabel(sportType);
            if (!label) return null;
            return (
              <span
                title={label.name}
                style={{
                  fontSize: 10, fontFamily: "var(--font-ui)", fontWeight: 700,
                  color: gear ? "var(--color-text-dim)" : "var(--color-text-dim)",
                  letterSpacing: "0.05em",
                  display: "flex", alignItems: "center", gap: 3,
                  marginLeft: "auto",
                }}
              >
                <span aria-hidden="true">{label.emoji}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>
                  {label.name}
                </span>
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ── Stat cell ────────────────────────────────────────────────────── */
function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--color-text-dim)", fontFamily: "var(--font-ui)", fontWeight: 700, letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: color ?? "var(--color-text-primary)", fontFamily: "var(--font-ui)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

/* ── Day column ───────────────────────────────────────────────────── */
function DayColumn({ dayIndex, date, activities, gearMap }: {
  dayIndex: number;
  date: Date;
  activities: StravaActivity[];
  gearMap: Record<string, SummaryGear>;
}) {
  const today = isToday(date);
  const future = isFuture(date);

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        padding: "8px 4px",
        borderBottom: `2px solid ${today ? "var(--color-orange)" : "var(--color-border)"}`,
        marginBottom: 4,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em",
          color: today ? "var(--color-orange)" : future ? "var(--color-text-dim)" : "var(--color-text-muted)",
        }}>
          {DAY_LABELS[dayIndex]}
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: today ? 700 : 400, fontSize: today ? 22 : 18,
          color: today ? "var(--color-text-primary)" : future ? "var(--color-text-dim)" : "var(--color-text-muted)",
          lineHeight: 1.1, marginTop: 2, fontVariantNumeric: "tabular-nums",
        }}>
          {date.getDate()}
        </div>
      </div>

      {activities.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {activities.map((a, i) => (
            <ActivityCard key={a.id} activity={a} index={i} gear={a.gear_id ? gearMap[a.gear_id] : undefined} />
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 4px" }}>
          {!future && (
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.06em" }}>
              REST
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Suggestion row ───────────────────────────────────────────────── */
function SuggestionRow({ activities, strain }: { activities: StravaActivity[]; strain: number }) {
  const suggestions = generateSuggestions(activities, strain);
  if (suggestions.length === 0) return null;

  const priorityColor: Record<string, string> = {
    high: "var(--color-orange)", medium: "#fdb999", low: "var(--color-text-muted)",
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {suggestions.map((s, i) => (
        <div
          key={i}
          className="animate-fade-up"
          style={{
            animationDelay: `${i * 80}ms`, opacity: 0,
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--color-surface)",
            border: `1px solid var(--color-border)`,
            borderLeft: `3px solid ${priorityColor[s.priority]}`,
            borderRadius: 6, padding: "8px 14px", flex: "1 1 200px",
            boxShadow: "inset 0 3px 5px rgba(0,0,0,.125)",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }}>{s.icon}</span>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-primary)", lineHeight: 1.4 }}>
            {s.text}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Strain gauge ─────────────────────────────────────────────────── */
function StrainGauge({ score }: { score: number }) {
  const { label, color } = strainLabel(score);
  const radius = 34;
  const stroke = 5;
  const normalizedRadius = radius - stroke;
  const circumference = 2 * Math.PI * normalizedRadius;
  const progress = Math.min(score / 21, 1);
  const dashOffset = circumference * (1 - progress);
  const arcTransition = prefersReducedMotion ? undefined : "stroke-dashoffset 0.6s cubic-bezier(0,1.085,0.4,1), stroke 0.4s ease";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 1, height: 52, background: "var(--color-border)", flexShrink: 0 }} />
      <div
        role="meter"
        aria-label="Weekly strain"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={21}
        style={{ position: "relative", width: radius * 2, height: radius * 2, flexShrink: 0 }}
      >
        <svg width={radius * 2} height={radius * 2} aria-hidden="true">
          <circle cx={radius} cy={radius} r={normalizedRadius} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
          <circle
            cx={radius} cy={radius} r={normalizedRadius}
            fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${radius} ${radius})`}
            style={{ transition: arcTransition }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: score >= 10 ? 16 : 18, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: "var(--color-text-dim)", fontFamily: "var(--font-ui)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 3 }}>
          WEEKLY STRAIN
        </div>
        <div style={{ fontSize: 13, color, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.04em" }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* ── Week summary ─────────────────────────────────────────────────── */
function WeekSummary({ activities }: { activities: StravaActivity[] }) {
  const totalDist = activities.reduce((s, a) => s + a.distance, 0);
  const totalTime = activities.reduce((s, a) => s + a.moving_time, 0);
  const totalElev = activities.reduce((s, a) => s + a.total_elevation_gain, 0);
  const activeDays = new Set(activities.map(a => a.start_date_local.slice(0, 10))).size;
  const strain = calculateWeeklyStrain(activities);
  const sports: Record<string, number> = {};
  activities.forEach(a => { const t = a.sport_type || a.type; sports[t] = (sports[t] ?? 0) + 1; });

  return (
    <div style={{
      background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8,
      padding: "14px 20px", display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap",
      justifyContent: "space-between", boxShadow: "inset 0 3px 5px rgba(0,0,0,.125)",
    }}>
      <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
        <SummaryItem label="ACTIVITIES" value={activities.length.toString()} accent />
        <SummaryItem label="ACTIVE DAYS" value={activeDays.toString()} />
        {totalDist > 0 && (
          <SummaryItem label="TOTAL DIST" value={`${new Intl.NumberFormat("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(totalDist / 1000)}km`} />
        )}
        <SummaryItem label="TOTAL TIME" value={formatTime(totalTime)} />
        {totalElev > 0 && <SummaryItem label="ELEVATION" value={`${Math.round(totalElev)}m`} />}
        {Object.entries(sports).map(([type, count]) => (
          <SummaryItem key={type} label={type.toUpperCase()} value={`${getSportEmoji(type)} ×${count}`} />
        ))}
      </div>
      <StrainGauge score={strain} />
    </div>
  );
}

function SummaryItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--color-text-dim)", fontFamily: "var(--font-ui)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, color: accent ? "var(--color-orange)" : "var(--color-text-primary)", fontFamily: "var(--font-display)", fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

/* ── Login screen ─────────────────────────────────────────────────── */
function LoginScreen({ error }: { error: string | null }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32, padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <StravaIcon size={48} />
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 36, color: "var(--color-text-primary)", letterSpacing: "-0.01em", textWrap: "balance" } as React.CSSProperties}>
          STRAVA WEEK
        </h1>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--color-text-muted)", letterSpacing: "0.08em" }}>
          YOUR PERSONAL ACTIVITY CALENDAR
        </p>
      </div>

      {error && (
        <div role="alert" style={{ background: "rgba(223,38,38,0.12)", border: "1px solid #df2626", borderRadius: 8, padding: "10px 16px", fontFamily: "var(--font-ui)", fontSize: 13, color: "#df2626" }}>
          {error === "denied" ? "Authorization was denied. Please try again." : "Something went wrong. Please try again."}
        </div>
      )}

      <a
        href="/api/auth"
        className="cta-btn"
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "var(--color-orange)", color: "white", textDecoration: "none",
          padding: "14px 28px", borderRadius: 8,
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.04em",
        }}
      >
        <Zap size={18} aria-hidden="true" />
        CONNECT WITH STRAVA
      </a>

      <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.05em", maxWidth: 320, textAlign: "center" }}>
        READS YOUR ACTIVITIES ONLY · NO WRITES · TOKENS STORED IN A SECURE HTTP-ONLY COOKIE
      </p>
    </div>
  );
}

/* ── Main app (needs Suspense for useSearchParams) ────────────────── */
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [calendarKey, setCalendarKey] = useState(0);
  const [panelOpen, setPanelOpen] = useState<PanelId | null>(null);

  // Sync week offset to/from URL param
  const weekOffset = Number(searchParams.get("week") ?? "0");

  const setWeekOffset = useCallback((updater: number | ((prev: number) => number)) => {
    const next = typeof updater === "function" ? updater(weekOffset) : updater;
    const params = new URLSearchParams(searchParams.toString());
    if (next === 0) { params.delete("week"); } else { params.set("week", String(next)); }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [weekOffset, router, searchParams]);

  const targetDate = (() => { const d = new Date(); d.setDate(d.getDate() + weekOffset * 7); return d; })();
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("error");
    if (e) setError(e);
  }, []);

  const goWeek = useCallback((delta: number) => {
    setDirection(delta < 0 ? "backward" : "forward");
    setCalendarKey(k => k + 1);
    setWeekOffset(w => w + delta);
  }, [setWeekOffset]);

  const goToday = useCallback(() => {
    setDirection(weekOffset < 0 ? "forward" : "backward");
    setCalendarKey(k => k + 1);
    setWeekOffset(0);
  }, [weekOffset, setWeekOffset]);

  if (authed === false) return <LoginScreen error={error} />;

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

  const gearMap: Record<string, SummaryGear> = {};
  [...(athlete?.bikes ?? []), ...(athlete?.shoes ?? [])].forEach(g => { gearMap[g.id] = g; });

  const isCurrentWeek = weekOffset === 0;
  const weekLabel = isCurrentWeek ? "THIS WEEK" : formatWeekLabel(weekStart, weekEnd).toUpperCase();
  const activityCount = activities.length;
  const calendarClass = `calendar-grid ${direction === "forward" ? "calendar-enter-forward" : "calendar-enter-backward"}`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", padding: "0 0 48px" }}>
      <nav
        aria-label="Site navigation"
        style={{
          borderBottom: "1px solid var(--color-border)",
          padding: "12px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: "var(--color-bg)", zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StravaIcon size={28} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--color-text-primary)", letterSpacing: "0.02em" }}>
            STRAVA WEEK
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={loadActivities}
            aria-label="Refresh activities"
            style={{ background: "transparent", border: "none", color: "var(--color-text-dim)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
          >
            <RefreshCw size={15} className={loading ? "animate-pulse" : ""} aria-hidden="true" />
          </button>
          {athlete && <ProfileMenu athlete={athlete} onOpen={setPanelOpen} />}
        </div>
      </nav>

      {/* Panel overlays */}
      {panelOpen === "profile"  && athlete && <Panel title="PROFILE"      onClose={() => setPanelOpen(null)}><ProfilePanel  athlete={athlete} /></Panel>}
      {panelOpen === "settings" && athlete && <Panel title="SETTINGS"     onClose={() => setPanelOpen(null)}><SettingsPanel athlete={athlete} /></Panel>}
      {panelOpen === "garage"   && athlete && <Panel title="BIKE GARAGE"  onClose={() => setPanelOpen(null)}><BikeGaragePanel bikes={athlete.bikes ?? []} /></Panel>}
      {panelOpen === "progress"            && <Panel title="PROGRESS"     onClose={() => setPanelOpen(null)}><ProgressPanel /></Panel>}

      <main id="main" style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>
        {/* Week header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => goWeek(-1)}
              aria-label="Previous week"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>

            <div>
              <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--color-text-primary)", lineHeight: 1.1, textWrap: "balance" } as React.CSSProperties}>
                {weekLabel}
              </h1>
              {isCurrentWeek && (
                <div suppressHydrationWarning style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                  {formatWeekLabel(weekStart, weekEnd)}
                </div>
              )}
            </div>

            <button
              onClick={() => goWeek(1)}
              disabled={weekOffset >= 0}
              aria-label="Next week"
              style={{
                background: "var(--color-surface)", border: "1px solid var(--color-border)",
                color: weekOffset >= 0 ? "var(--color-text-dim)" : "var(--color-text-primary)",
                borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: weekOffset >= 0 ? "default" : "pointer", opacity: weekOffset >= 0 ? 0.4 : 1,
              }}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>

            {weekOffset !== 0 && (
              <button
                onClick={goToday}
                className="animate-fade-up"
                style={{
                  background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-orange)",
                  borderRadius: 6, padding: "4px 12px", fontFamily: "var(--font-ui)", fontSize: 11,
                  fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer",
                }}
              >
                TODAY
              </button>
            )}
          </div>

          <div
            aria-live="polite"
            aria-atomic="true"
            style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.06em" }}
          >
            {loading ? "LOADING…" : `${activityCount} ACTIVIT${activityCount !== 1 ? "IES" : "Y"}`}
          </div>
        </div>

        {/* Weekly summary + suggestions */}
        {!loading && activities.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <WeekSummary activities={activities} />
            <SuggestionRow activities={activities} strain={calculateWeeklyStrain(activities)} />
          </div>
        )}

        {/* Calendar grid — scrollable on mobile */}
        {loading ? (
          <div className="calendar-scroll">
            <div className="calendar-grid" aria-busy="true" aria-label="Loading activities">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ background: "var(--color-surface)", borderRadius: 8, height: 200, border: "1px solid var(--color-border)", animation: "pulse 2s ease-in-out infinite", animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="calendar-scroll">
            <div key={calendarKey} className={calendarClass}>
              {days.map((date, i) => {
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                return (
                  <DayColumn key={key} dayIndex={i} date={date} activities={activitiesByDay[key] ?? []} gearMap={gearMap} />
                );
              })}
            </div>
          </div>
        )}

        {!loading && activities.length === 0 && authed && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-text-dim)", fontFamily: "var(--font-ui)", fontSize: 13, letterSpacing: "0.06em" }}>
            NO ACTIVITIES THIS WEEK — REST UP
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Root export (Suspense required for useSearchParams) ──────────── */
export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
