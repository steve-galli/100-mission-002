"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, RefreshCw, User, Settings, Bike, TrendingUp, X, Zap } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);
import {
  StravaActivity,
  StravaAthlete,
  AthleteStats,
  DetailedActivity,
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
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (prefersReducedMotion || !panelRef.current || !backdropRef.current) {
      onClose();
      return;
    }
    gsap.to(panelRef.current, { x: 480, duration: 0.2, ease: "power2.in" });
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.18, onComplete: onClose });
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  useEffect(() => {
    if (prefersReducedMotion || !panelRef.current || !backdropRef.current) {
      ScrollTrigger.refresh();
      return;
    }
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(panelRef.current, { x: 480 }, { x: 0, duration: 0.3, ease: "power3.out", onComplete: () => ScrollTrigger.refresh() });
  }, []); // eslint-disable-line

  return (
    <>
      <div ref={backdropRef} onClick={handleClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300 }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={title}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
          background: "var(--color-bg)", borderLeft: "1px solid var(--color-border)",
          zIndex: 301, display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.04em", color: "var(--color-text-primary)" }}>
            {title}
          </span>
          <button
            onClick={handleClose}
            aria-label="Close"
            onMouseEnter={e => !prefersReducedMotion && gsap.to(e.currentTarget, { rotate: 90, scale: 1.1, duration: 0.18, ease: "power2.out" })}
            onMouseLeave={e => !prefersReducedMotion && gsap.to(e.currentTarget, { rotate: 0, scale: 1, duration: 0.14, ease: "power2.out" })}
            style={{ background: "transparent", border: "none", color: "var(--color-text-dim)", cursor: "pointer", display: "flex", padding: 4 }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
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

function EditablePanelRow({ label, defaultValue, storageKey }: { label: string; defaultValue: string; storageKey: string }) {
  const [val, setVal] = useState(defaultValue);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) setVal(stored);
  }, [storageKey]);

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>{label}</span>
      <input
        value={val}
        onChange={e => { setVal(e.target.value); localStorage.setItem(storageKey, e.target.value); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: "transparent", border: "none",
          borderBottom: `1px solid ${focused ? "var(--color-orange)" : "var(--color-border)"}`,
          color: "var(--color-text-primary)", fontFamily: "var(--font-ui)", fontSize: 13,
          fontWeight: 700, fontVariantNumeric: "tabular-nums", textAlign: "right",
          width: 130, padding: "0 2px", outline: "none", cursor: "text",
          transition: "border-color 0.15s",
        }}
      />
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

function isGravelBike(name: string) {
  return /gravel|cx|cyclocross/i.test(name);
}

function isMTBike(name: string) {
  return /mountain|mtb|trail|enduro/i.test(name);
}

function isRoadBike(name: string) {
  const n = name.toLowerCase();
  return !n.includes("mountain") && !n.includes("mtb") && !n.includes("trail") && !n.includes("enduro") &&
    !n.includes("gravel") && !n.includes("cx") && !n.includes("cyclocross") &&
    !n.includes("e-bike") && !n.includes("ebike") && !n.includes("electric") &&
    !n.includes("commute") && !n.includes("city") && !n.includes("cargo");
}

/* Canyon Grail 7 — Size S geometry diagram */
function CanyonGrailSmallDiagram() {
  // SVG coordinate constants (scale: 0.30 px/mm)
  // Rear axle origin, all points derived from actual geometry
  const RAx=55, RAy=235, FAx=363, FAy=235;
  const BBx=182, BBy=258;   // BB: 423mm fwd of RA, 75mm below axle
  const STx=140, STy=116;   // seat tube top: 492mm @ 73.5°
  const HTTx=299, HTTy=91;  // head tube top: stack=556, reach=390 from BB
  const HTBx=311, HTBy=126; // head tube bottom: 124mm @ 70.75°
  const rw=107;              // wheel radius: 355mm * 0.30
  const dim="#fc5200";
  const fr="#c8c8c8";
  const ft="#727270";
  const spokes = [0,45,90,135].map(a => a * Math.PI / 180);

  return (
    <div>
      <svg viewBox="0 0 560 372" style={{ width:"100%", display:"block", marginBottom:16 }}
        aria-label="Canyon Grail 7 geometry diagram, Size S">

        {/* Axle-level reference */}
        <line x1="0" y1={RAy} x2="430" y2={RAy} stroke="#252523" strokeWidth="1" strokeDasharray="3,7"/>

        {/* Wheels */}
        {([RAx, FAx] as number[]).map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy={RAy} r={rw} fill="none" stroke="#3e3e3c" strokeWidth="2"/>
            {spokes.map(rad => (
              <line key={rad}
                x1={cx + rw*0.82*Math.cos(rad)} y1={RAy + rw*0.82*Math.sin(rad)}
                x2={cx - rw*0.82*Math.cos(rad)} y2={RAy - rw*0.82*Math.sin(rad)}
                stroke="#2c2c2a" strokeWidth="0.8"/>
            ))}
            <circle cx={cx} cy={RAy} r={5} fill="#3a3a38"/>
          </g>
        ))}

        {/* Frame — back to front */}
        <line x1={BBx} y1={BBy} x2={RAx} y2={RAy} stroke={ft} strokeWidth="3" strokeLinecap="round"/>
        <line x1={RAx} y1={RAy} x2={STx} y2={STy} stroke={ft} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1={HTBx} y1={HTBy} x2={FAx} y2={FAy} stroke={ft} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1={BBx} y1={BBy} x2={STx} y2={STy} stroke={fr} strokeWidth="4" strokeLinecap="round"/>
        <line x1={STx} y1={STy} x2={HTTx} y2={HTTy} stroke={fr} strokeWidth="3.5" strokeLinecap="round"/>
        <line x1={BBx} y1={BBy} x2={HTBx} y2={HTBy} stroke={fr} strokeWidth="4.5" strokeLinecap="round"/>
        <line x1={HTTx} y1={HTTy} x2={HTBx} y2={HTBy} stroke={fr} strokeWidth="6" strokeLinecap="round"/>

        {/* BB */}
        <circle cx={BBx} cy={BBy} r={7} fill="#21211f" stroke={dim} strokeWidth="2"/>

        {/* Saddle */}
        <line x1={STx} y1={STy} x2={STx+2} y2={STy-10} stroke="#666" strokeWidth="2.5"/>
        <line x1={STx-15} y1={STy-10} x2={STx+17} y2={STy-10} stroke="#888" strokeWidth="4" strokeLinecap="round"/>

        {/* Canyon Grail Hover Bar (double-decker) */}
        <line x1={HTTx+5} y1={HTTy} x2={318} y2={HTTy-10} stroke="#666" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1={301} y1={HTTy-18} x2={345} y2={HTTy-18} stroke="#aaa" strokeWidth="4" strokeLinecap="round"/>
        <line x1={301} y1={HTTy-18} x2={297} y2={HTTy-7} stroke="#888" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1={345} y1={HTTy-18} x2={349} y2={HTTy-7} stroke="#888" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1={297} y1={HTTy-7} x2={349} y2={HTTy-7} stroke="#888" strokeWidth="2.5" strokeLinecap="round"/>

        {/* === ANNOTATIONS === */}

        {/* (h) Wheelbase */}
        <line x1={RAx} y1={RAy} x2={RAx} y2={356} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={FAx} y1={FAy} x2={FAx} y2={356} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={RAx} y1={354} x2={FAx} y2={354} stroke={dim} strokeWidth="0.9"/>
        <line x1={RAx} y1={351} x2={RAx} y2={357} stroke={dim} strokeWidth="1.2"/>
        <line x1={FAx} y1={351} x2={FAx} y2={357} stroke={dim} strokeWidth="1.2"/>
        <text x={(RAx+FAx)/2} y={368} textAnchor="middle" fontFamily="var(--font-ui)" fontSize="8.5" fill={dim} letterSpacing="0.04em">(h) 1 027 mm</text>

        {/* (i) Stack */}
        <line x1={BBx} y1={BBy} x2={444} y2={BBy} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={HTTx} y1={HTTy} x2={444} y2={HTTy} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={442} y1={BBy} x2={442} y2={HTTy} stroke={dim} strokeWidth="0.9"/>
        <line x1={439} y1={BBy} x2={445} y2={BBy} stroke={dim} strokeWidth="1.2"/>
        <line x1={439} y1={HTTy} x2={445} y2={HTTy} stroke={dim} strokeWidth="1.2"/>
        <text x={450} y={(BBy+HTTy)/2+3} fontFamily="var(--font-ui)" fontSize="8.5" fill={dim} letterSpacing="0.04em">(i) 556 mm</text>

        {/* (j) Reach */}
        <line x1={BBx} y1={BBy} x2={BBx} y2={57} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={HTTx} y1={HTTy} x2={HTTx} y2={57} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={BBx} y1={59} x2={HTTx} y2={59} stroke={dim} strokeWidth="0.9"/>
        <line x1={BBx} y1={56} x2={BBx} y2={62} stroke={dim} strokeWidth="1.2"/>
        <line x1={HTTx} y1={56} x2={HTTx} y2={62} stroke={dim} strokeWidth="1.2"/>
        <text x={(BBx+HTTx)/2} y={51} textAnchor="middle" fontFamily="var(--font-ui)" fontSize="8.5" fill={dim} letterSpacing="0.04em">(j) 390 mm</text>

        {/* Letter badges on tubes */}
        {([
          [155, 190, "b"],
          [220, 113, "c"],
          [290, 111, "d"],
          [119, 238, "g"],
        ] as [number,number,string][]).map(([x,y,ltr]) => (
          <g key={ltr}>
            <circle cx={x} cy={y} r={7} fill="#21211f" stroke={dim} strokeWidth="1.2"/>
            <text x={x} y={y+3} textAnchor="middle" fontFamily="var(--font-ui)" fontSize="7.5" fill={dim} fontWeight="700">{ltr}</text>
          </g>
        ))}

        {/* Model label */}
        <text x={472} y={190} fontFamily="var(--font-display)" fontSize="11" fill="#303030" fontWeight="700" letterSpacing="0.05em">CANYON</text>
        <text x={472} y={204} fontFamily="var(--font-display)" fontSize="11" fill="#303030" fontWeight="700" letterSpacing="0.05em">GRAIL 7</text>
        <text x={472} y={217} fontFamily="var(--font-ui)" fontSize="8.5" fill="#262624" letterSpacing="0.09em">SIZE S</text>
      </svg>

      {/* Size S basic geometry */}
      <PanelSection label="BASIC GEOMETRY — SIZE S" />
      <PanelRow label="Rider Height" value="172 – 178 cm" />
      <PanelRow label="(a) Seat Height" value="655 – 775 mm" />
      <PanelRow label="(b) Seat Tube" value="492 mm" />
      <PanelRow label="(c) Top Tube" value="555 mm" />
      <PanelRow label="(d) Head Tube" value="124 mm" />
      <PanelRow label="(e) Head Tube Angle" value="70.75°" />
      <PanelRow label="(f) Seat Tube Angle" value="73.5°" />
      <PanelRow label="(g) Chainstay" value="430 mm" />
      <PanelRow label="(h) Wheelbase" value="1 027 mm" />
      <PanelRow label="(i) Stack" value="556 mm" />
      <PanelRow label="(j) Reach" value="390 mm" />
      <PanelRow label="(k) Stand-over" value="781 mm" />
      <PanelRow label="(l) BB Offset" value="75 mm" />
      <PanelRow label="Stack+" value="647 mm" />
      <PanelRow label="Reach+" value="447 mm" />

      {/* Size S component geometry — editable fit data */}
      <PanelSection label="COMPONENTS — SIZE S" />
      <PanelRow label="Spacer" value="27.5 mm" />
      <EditablePanelRow label="Stem" defaultValue="80 mm" storageKey="fit_canyon_grail_s_stem" />
      <EditablePanelRow label="Handlebar Width" defaultValue="420 mm" storageKey="fit_canyon_grail_s_bar_width" />
      <EditablePanelRow label="Crank Length" defaultValue="170 mm" storageKey="fit_canyon_grail_s_crank" />
      <PanelRow label="Chainring" value="46 / 30" />
      <PanelRow label="Seat Post Ø" value="27.2 mm" />
      <EditablePanelRow label="Seat Post Length" defaultValue="345 mm" storageKey="fit_canyon_grail_s_seatpost" />
      <PanelRow label="Wheel Size" value={'28"'} />
      <PanelRow label="Disc Size" value="160 / 160 mm" />
    </div>
  );
}

/* Orbea Avant — Size 53 geometry diagram */
function OrbeaAvant53Diagram() {
  // SVG coordinate constants (scale: 0.30 px/mm)
  // Size 53: wheelbase=992, stack=572, reach=378, BB drop=73, chainstay=415
  const RAx=55,  RAy=235, FAx=353, FAy=235;
  const BBx=178, BBy=257;   // BB: 408mm fwd of RA, 73mm below axle
  const STx=136, STy=116;   // seat tube top: 490mm @ 73.5°
  const HTTx=291, HTTy=85;  // head tube top: stack=572, reach=378 from BB
  const HTBx=305, HTBy=130; // head tube bottom: 158mm @ 72.4°
  const rw=107;
  const dim="#fc5200";
  const fr="#c8c8c8";
  const ft="#727270";
  const spokes = [0,45,90,135].map(a => a * Math.PI / 180);

  return (
    <div>
      <svg viewBox="0 0 560 372" style={{ width:"100%", display:"block", marginBottom:16 }}
        aria-label="Orbea Avant geometry diagram, Size 53">

        {/* Axle-level reference */}
        <line x1="0" y1={RAy} x2="430" y2={RAy} stroke="#252523" strokeWidth="1" strokeDasharray="3,7"/>

        {/* Wheels */}
        {([RAx, FAx] as number[]).map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy={RAy} r={rw} fill="none" stroke="#3e3e3c" strokeWidth="2"/>
            {spokes.map(rad => (
              <line key={rad}
                x1={cx + rw*0.82*Math.cos(rad)} y1={RAy + rw*0.82*Math.sin(rad)}
                x2={cx - rw*0.82*Math.cos(rad)} y2={RAy - rw*0.82*Math.sin(rad)}
                stroke="#2c2c2a" strokeWidth="0.8"/>
            ))}
            <circle cx={cx} cy={RAy} r={5} fill="#3a3a38"/>
          </g>
        ))}

        {/* Frame — back to front */}
        <line x1={BBx} y1={BBy} x2={RAx} y2={RAy} stroke={ft} strokeWidth="3" strokeLinecap="round"/>
        <line x1={RAx} y1={RAy} x2={STx} y2={STy} stroke={ft} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1={HTBx} y1={HTBy} x2={FAx} y2={FAy} stroke={ft} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1={BBx} y1={BBy} x2={STx} y2={STy} stroke={fr} strokeWidth="4" strokeLinecap="round"/>
        <line x1={STx} y1={STy} x2={HTTx} y2={HTTy} stroke={fr} strokeWidth="3.5" strokeLinecap="round"/>
        <line x1={BBx} y1={BBy} x2={HTBx} y2={HTBy} stroke={fr} strokeWidth="4.5" strokeLinecap="round"/>
        <line x1={HTTx} y1={HTTy} x2={HTBx} y2={HTBy} stroke={fr} strokeWidth="6" strokeLinecap="round"/>

        {/* BB */}
        <circle cx={BBx} cy={BBy} r={7} fill="#21211f" stroke={dim} strokeWidth="2"/>

        {/* Saddle */}
        <line x1={STx} y1={STy} x2={STx+2} y2={STy-10} stroke="#666" strokeWidth="2.5"/>
        <line x1={STx-15} y1={STy-10} x2={STx+17} y2={STy-10} stroke="#888" strokeWidth="4" strokeLinecap="round"/>

        {/* Road drop bar */}
        <line x1={HTTx+5} y1={HTTy} x2={318} y2={77} stroke="#666" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1={298} y1={74} x2={338} y2={74} stroke="#aaa" strokeWidth="4" strokeLinecap="round"/>
        <path d="M 298,74 Q 294,88 294,97 Q 296,106 303,106" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M 338,74 Q 342,88 342,97 Q 340,106 333,106" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round"/>

        {/* === ANNOTATIONS === */}

        {/* (7) Wheelbase */}
        <line x1={RAx} y1={RAy} x2={RAx} y2={356} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={FAx} y1={FAy} x2={FAx} y2={356} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={RAx} y1={354} x2={FAx} y2={354} stroke={dim} strokeWidth="0.9"/>
        <line x1={RAx} y1={351} x2={RAx} y2={357} stroke={dim} strokeWidth="1.2"/>
        <line x1={FAx} y1={351} x2={FAx} y2={357} stroke={dim} strokeWidth="1.2"/>
        <text x={(RAx+FAx)/2} y={368} textAnchor="middle" fontFamily="var(--font-ui)" fontSize="8.5" fill={dim} letterSpacing="0.04em">(7) 992 mm</text>

        {/* (12) Stack */}
        <line x1={BBx} y1={BBy} x2={444} y2={BBy} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={HTTx} y1={HTTy} x2={444} y2={HTTy} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={442} y1={BBy} x2={442} y2={HTTy} stroke={dim} strokeWidth="0.9"/>
        <line x1={439} y1={BBy} x2={445} y2={BBy} stroke={dim} strokeWidth="1.2"/>
        <line x1={439} y1={HTTy} x2={445} y2={HTTy} stroke={dim} strokeWidth="1.2"/>
        <text x={450} y={(BBy+HTTy)/2+3} fontFamily="var(--font-ui)" fontSize="8.5" fill={dim} letterSpacing="0.04em">(12) 572 mm</text>

        {/* (11) Reach */}
        <line x1={BBx} y1={BBy} x2={BBx} y2={57} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={HTTx} y1={HTTy} x2={HTTx} y2={57} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={BBx} y1={59} x2={HTTx} y2={59} stroke={dim} strokeWidth="0.9"/>
        <line x1={BBx} y1={56} x2={BBx} y2={62} stroke={dim} strokeWidth="1.2"/>
        <line x1={HTTx} y1={56} x2={HTTx} y2={62} stroke={dim} strokeWidth="1.2"/>
        <text x={(BBx+HTTx)/2} y={51} textAnchor="middle" fontFamily="var(--font-ui)" fontSize="8.5" fill={dim} letterSpacing="0.04em">(11) 378 mm</text>

        {/* Number badges on tubes */}
        {([
          [150, 188, "1"],
          [214, 107, "2"],
          [281, 107, "3"],
          [116, 238, "4"],
          [323, 180, "13"],
        ] as [number,number,string][]).map(([x,y,num]) => (
          <g key={num}>
            <circle cx={x} cy={y} r={7.5} fill="#21211f" stroke={dim} strokeWidth="1.2"/>
            <text x={x} y={y+3} textAnchor="middle" fontFamily="var(--font-ui)" fontSize={num.length > 1 ? "6" : "7.5"} fill={dim} fontWeight="700">{num}</text>
          </g>
        ))}

        {/* Model label */}
        <text x={462} y={190} fontFamily="var(--font-display)" fontSize="11" fill="#303030" fontWeight="700" letterSpacing="0.05em">ORBEA</text>
        <text x={462} y={204} fontFamily="var(--font-display)" fontSize="11" fill="#303030" fontWeight="700" letterSpacing="0.05em">AVANT</text>
        <text x={462} y={217} fontFamily="var(--font-ui)" fontSize="8.5" fill="#262624" letterSpacing="0.09em">SIZE 53</text>
      </svg>

      {/* Size 53 geometry */}
      <PanelSection label="GEOMETRY — SIZE 53" />
      <PanelRow label="Rider Height" value="173 – 179 cm" />
      <PanelRow label="(1) Seat Tube C-T" value="490 mm" />
      <PanelRow label="(2) Top Tube EFF" value="547 mm" />
      <PanelRow label="(3) Head Tube" value="158 mm" />
      <PanelRow label="(4) Chainstay" value="415 mm" />
      <PanelRow label="(5) BB Height" value="272 mm" />
      <PanelRow label="(6) BB Drop" value="73 mm" />
      <PanelRow label="(7) Wheelbase" value="992 mm" />
      <PanelRow label="(8) Head Angle" value="72.4°" />
      <PanelRow label="(9) Seat Angle" value="73.5°" />
      <PanelRow label="(10) Standover" value="793 mm" />
      <PanelRow label="(11) Reach" value="378 mm" />
      <PanelRow label="(12) Stack" value="572 mm" />
      <PanelRow label="(13) Fork Length" value="380 mm" />
      <PanelRow label="(14) Rake" value="45 mm" />

      {/* Ergonomy — editable fit data */}
      <PanelSection label="ERGONOMY — SIZE 53" />
      <EditablePanelRow label="Crank Length" defaultValue="172.5 mm" storageKey="fit_orbea_avant_53_crank" />
      <EditablePanelRow label="Handlebar Width" defaultValue="420 mm" storageKey="fit_orbea_avant_53_bar_width" />
      <EditablePanelRow label="Stem Length" defaultValue="110 mm" storageKey="fit_orbea_avant_53_stem" />
    </div>
  );
}

/* Orbea Oiz H — Size S-29 XC geometry diagram */
function OrbeaOizSDiagram() {
  // SVG coordinate constants (scale: 0.30 px/mm)
  // Size S-29 XC: wheelbase=1094, stack=586, reach=407, BB drop=47, chainstay=435, fork=504
  const RAx=55,  RAy=230, FAx=383, FAy=230;
  const BBx=185, BBy=244;   // BB: 432mm fwd of RA, 47mm below axle
  const STx=154, STy=127;   // seat tube top: 405mm @ 75°
  const HTTx=307, HTTy=68;  // head tube top: stack=586, reach=407 from BB
  const HTBx=317, HTBy=93;  // head tube bottom: 90mm @ 69°
  const rw=110;              // 29" wheel radius (368mm * 0.30)
  const dim="#fc5200";
  const fr="#c8c8c8";
  const ft="#727270";
  const spokes = [0,45,90,135].map(a => a * Math.PI / 180);

  return (
    <div>
      <svg viewBox="0 0 610 385" style={{ width:"100%", display:"block", marginBottom:16 }}
        aria-label="Orbea Oiz H geometry diagram, Size S-29 XC">

        {/* Axle-level reference */}
        <line x1="0" y1={RAy} x2="450" y2={RAy} stroke="#252523" strokeWidth="1" strokeDasharray="3,7"/>

        {/* Wheels */}
        {([RAx, FAx] as number[]).map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy={RAy} r={rw} fill="none" stroke="#3e3e3c" strokeWidth="2"/>
            {spokes.map(rad => (
              <line key={rad}
                x1={cx + rw*0.82*Math.cos(rad)} y1={RAy + rw*0.82*Math.sin(rad)}
                x2={cx - rw*0.82*Math.cos(rad)} y2={RAy - rw*0.82*Math.sin(rad)}
                stroke="#2c2c2a" strokeWidth="0.8"/>
            ))}
            <circle cx={cx} cy={RAy} r={5} fill="#3a3a38"/>
          </g>
        ))}

        {/* Frame — back to front */}
        {/* Chainstay */}
        <line x1={BBx} y1={BBy} x2={RAx} y2={RAy} stroke={ft} strokeWidth="3" strokeLinecap="round"/>
        {/* Seatstay */}
        <line x1={RAx} y1={RAy} x2={STx} y2={STy} stroke={ft} strokeWidth="2.5" strokeLinecap="round"/>
        {/* Suspension fork — slightly thicker to suggest fork legs */}
        <line x1={HTBx+3} y1={HTBy} x2={FAx+2} y2={FAy} stroke={ft} strokeWidth="3.5" strokeLinecap="round"/>
        <line x1={HTBx-1} y1={HTBy} x2={FAx-2} y2={FAy} stroke="#4a4a48" strokeWidth="2" strokeLinecap="round"/>
        {/* Seat tube */}
        <line x1={BBx} y1={BBy} x2={STx} y2={STy} stroke={fr} strokeWidth="4" strokeLinecap="round"/>
        {/* Top tube */}
        <line x1={STx} y1={STy} x2={HTTx} y2={HTTy} stroke={fr} strokeWidth="3.5" strokeLinecap="round"/>
        {/* Down tube */}
        <line x1={BBx} y1={BBy} x2={HTBx} y2={HTBy} stroke={fr} strokeWidth="4.5" strokeLinecap="round"/>
        {/* Head tube */}
        <line x1={HTTx} y1={HTTy} x2={HTBx} y2={HTBy} stroke={fr} strokeWidth="6" strokeLinecap="round"/>

        {/* BB */}
        <circle cx={BBx} cy={BBy} r={7} fill="#21211f" stroke={dim} strokeWidth="2"/>

        {/* Saddle */}
        <line x1={STx} y1={STy} x2={STx+2} y2={STy-10} stroke="#666" strokeWidth="2.5"/>
        <line x1={STx-15} y1={STy-10} x2={STx+17} y2={STy-10} stroke="#888" strokeWidth="4" strokeLinecap="round"/>

        {/* MTB riser bar */}
        <line x1={HTTx+5} y1={HTTy} x2={313} y2={50} stroke="#666" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Bar sweep — wide flat bar with slight rise */}
        <line x1={283} y1={44} x2={343} y2={44} stroke="#aaa" strokeWidth="4.5" strokeLinecap="round"/>
        {/* Rise at outer ends */}
        <line x1={283} y1={44} x2={280} y2={48} stroke="#888" strokeWidth="4" strokeLinecap="round"/>
        <line x1={343} y1={44} x2={346} y2={48} stroke="#888" strokeWidth="4" strokeLinecap="round"/>

        {/* === ANNOTATIONS === */}

        {/* (7) Wheelbase */}
        <line x1={RAx} y1={RAy} x2={RAx} y2={358} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={FAx} y1={FAy} x2={FAx} y2={358} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={RAx} y1={356} x2={FAx} y2={356} stroke={dim} strokeWidth="0.9"/>
        <line x1={RAx} y1={353} x2={RAx} y2={359} stroke={dim} strokeWidth="1.2"/>
        <line x1={FAx} y1={353} x2={FAx} y2={359} stroke={dim} strokeWidth="1.2"/>
        <text x={(RAx+FAx)/2} y={371} textAnchor="middle" fontFamily="var(--font-ui)" fontSize="8.5" fill={dim} letterSpacing="0.04em">(7) 1 094 mm</text>

        {/* (12) Stack */}
        <line x1={BBx} y1={BBy} x2={476} y2={BBy} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={HTTx} y1={HTTy} x2={476} y2={HTTy} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={474} y1={BBy} x2={474} y2={HTTy} stroke={dim} strokeWidth="0.9"/>
        <line x1={471} y1={BBy} x2={477} y2={BBy} stroke={dim} strokeWidth="1.2"/>
        <line x1={471} y1={HTTy} x2={477} y2={HTTy} stroke={dim} strokeWidth="1.2"/>
        <text x={482} y={(BBy+HTTy)/2+3} fontFamily="var(--font-ui)" fontSize="8.5" fill={dim} letterSpacing="0.04em">(12) 586 mm</text>

        {/* (11) Reach */}
        <line x1={BBx} y1={BBy} x2={BBx} y2={40} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={HTTx} y1={HTTy} x2={HTTx} y2={40} stroke={dim} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.55"/>
        <line x1={BBx} y1={42} x2={HTTx} y2={42} stroke={dim} strokeWidth="0.9"/>
        <line x1={BBx} y1={39} x2={BBx} y2={45} stroke={dim} strokeWidth="1.2"/>
        <line x1={HTTx} y1={39} x2={HTTx} y2={45} stroke={dim} strokeWidth="1.2"/>
        <text x={(BBx+HTTx)/2} y={34} textAnchor="middle" fontFamily="var(--font-ui)" fontSize="8.5" fill={dim} letterSpacing="0.04em">(11) 407 mm</text>

        {/* Number badges on tubes */}
        {([
          [163, 187, "1"],
          [231, 103, "2"],
          [294, 81,  "3"],
          [121, 229, "4"],
          [344, 162, "13"],
        ] as [number,number,string][]).map(([x,y,num]) => (
          <g key={num}>
            <circle cx={x} cy={y} r={7.5} fill="#21211f" stroke={dim} strokeWidth="1.2"/>
            <text x={x} y={y+3} textAnchor="middle" fontFamily="var(--font-ui)" fontSize={num.length > 1 ? "6" : "7.5"} fill={dim} fontWeight="700">{num}</text>
          </g>
        ))}

        {/* Model label */}
        <text x={502} y={175} fontFamily="var(--font-display)" fontSize="11" fill="#303030" fontWeight="700" letterSpacing="0.05em">ORBEA</text>
        <text x={502} y={189} fontFamily="var(--font-display)" fontSize="11" fill="#303030" fontWeight="700" letterSpacing="0.05em">OIZ H</text>
        <text x={502} y={202} fontFamily="var(--font-ui)" fontSize="8.5" fill="#262624" letterSpacing="0.09em">S-29 XC</text>
      </svg>

      {/* Size S-29 XC geometry */}
      <PanelSection label="GEOMETRY — S-29 XC" />
      <PanelRow label="Rider Height" value="155 – 170 cm" />
      <PanelRow label="(1) Seat Tube C-T" value="405 mm" />
      <PanelRow label="(2) Top Tube EFF" value="564 mm" />
      <PanelRow label="(3) Head Tube" value="90 mm" />
      <PanelRow label="(4) Chainstay" value="435 mm" />
      <PanelRow label="(5) BB Height" value="327 mm" />
      <PanelRow label="(6) BB Drop" value="47 mm" />
      <PanelRow label="(7) Wheelbase" value="1 094 mm" />
      <PanelRow label="(8) Head Angle" value="69°" />
      <PanelRow label="(9) Seat Angle" value="75°" />
      <PanelRow label="(10) Standover" value="732 mm" />
      <PanelRow label="(11) Reach" value="407 mm" />
      <PanelRow label="(12) Stack" value="586 mm" />
      <PanelRow label="(13) Fork Length" value="504 mm" />

      {/* Technical specs */}
      <PanelSection label="TECHNICAL SPECS" />
      <PanelRow label="Wheel Size" value={'29"'} />
      <PanelRow label="Max Tyre" value="29 × 2.4" />
      <PanelRow label="Fork Offset" value="44 mm" />
      <PanelRow label="Rear Travel" value="100 mm" />
      <PanelRow label="Fork Travel" value="100 mm" />
      <PanelRow label="Seat Post Ø" value="31.6 mm" />
      <PanelRow label="Seat Post Max Insert" value="215 mm" />
      <PanelRow label="Rear Axle" value="Boost 148 × 12" />
      <PanelRow label="BB" value="PressKit PF92" />

      {/* Ergonomy — editable fit data */}
      <PanelSection label="ERGONOMY" />
      <EditablePanelRow label="Stem Length" defaultValue="50 mm" storageKey="fit_orbea_oiz_s_stem" />
      <EditablePanelRow label="Handlebar Width" defaultValue="760 mm" storageKey="fit_orbea_oiz_s_bar_width" />
      <EditablePanelRow label="Crank Length" defaultValue="170 mm" storageKey="fit_orbea_oiz_s_crank" />
    </div>
  );
}

function BikeGaragePanel({ bikes }: { bikes: SummaryGear[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedBike, setSelectedBike] = useState<SummaryGear | null>(null);

  useGSAP(() => {
    if (selectedBike || !bikes.length || prefersReducedMotion) return;
    const scroller = document.querySelector(".panel-scroll") as HTMLElement;
    if (!scroller) return;
    gsap.from(".bike-card", {
      opacity: 0, y: 10, scale: 0.96, stagger: 0.08, duration: 0.4, ease: "power2.out",
      scrollTrigger: { trigger: listRef.current, scroller, start: "top 90%", once: true },
    });
  }, { scope: listRef, dependencies: [bikes.length, selectedBike] });

  if (bikes.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-dim)", letterSpacing: "0.06em" }}>
        NO BIKES FOUND — ADD THEM IN STRAVA SETTINGS
      </div>
    );
  }

  if (selectedBike) {
    return (
      <div>
        <button
          onClick={() => setSelectedBike(null)}
          onMouseEnter={e => !prefersReducedMotion && gsap.to(e.currentTarget, { x: -3, duration: 0.12, ease: "power2.out" })}
          onMouseLeave={e => !prefersReducedMotion && gsap.to(e.currentTarget, { x: 0, duration: 0.1, ease: "power2.out" })}
          style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-ui)", fontSize: 11,
            fontWeight: 700, letterSpacing: "0.06em", padding: "0 0 16px", marginBottom: 4 }}
        >
          ← BACK
        </button>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--color-text-primary)", marginBottom: 3 }}>
          {selectedBike.name}
        </div>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums", marginBottom: 20 }}>
          {new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(selectedBike.distance / 1000)} km total
        </div>
        {isGravelBike(selectedBike.name) ? (
          <CanyonGrailSmallDiagram />
        ) : isMTBike(selectedBike.name) ? (
          <OrbeaOizSDiagram />
        ) : isRoadBike(selectedBike.name) ? (
          <OrbeaAvant53Diagram />
        ) : (
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-dim)", padding: "24px 0", textAlign: "center", letterSpacing: "0.06em" }}>
            NO GEOMETRY DIAGRAM AVAILABLE
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {bikes.map(bike => (
        <div
          key={bike.id}
          className="bike-card"
          onClick={() => setSelectedBike(bike)}
          onMouseEnter={e => !prefersReducedMotion && gsap.to(e.currentTarget, { y: -2, duration: 0.14, ease: "power2.out" })}
          onMouseLeave={e => !prefersReducedMotion && gsap.to(e.currentTarget, { y: 0, duration: 0.12, ease: "power2.out" })}
          style={{
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: 8, padding: "14px 16px", cursor: "pointer",
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
          <span style={{ color: "var(--color-text-dim)", flexShrink: 0 }}>›</span>
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open || !dropdownRef.current || prefersReducedMotion) return;
    gsap.fromTo(dropdownRef.current,
      { opacity: 0, scaleY: 0.88, y: -6 },
      { opacity: 1, scaleY: 1, y: 0, duration: 0.2, ease: "power2.out", transformOrigin: "top right" }
    );
    const items = dropdownRef.current.querySelectorAll("button[role='menuitem'], a[role='menuitem']");
    gsap.fromTo(items,
      { opacity: 0, y: -4 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.18, ease: "power2.out" }
    );
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
          ref={dropdownRef}
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: 8, padding: 4, minWidth: 180,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 200,
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

/* ── Activity detail panel ────────────────────────────────────────── */
function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid var(--color-border)" }}>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-muted)", letterSpacing: "0.04em", flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 700, color: accent ? "var(--color-orange)" : "var(--color-text-primary)", fontVariantNumeric: "tabular-nums", textAlign: "right", marginLeft: 12 }}>{value}</span>
    </div>
  );
}

function DetailSection({ label }: { label: string }) {
  return (
    <div className="detail-section-header" style={{ fontFamily: "var(--font-ui)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--color-text-dim)", marginTop: 20, marginBottom: 4 }}>
      {label}
    </div>
  );
}

function ActivityRouteMap({ polyline, color }: { polyline: string; color: string }) {
  const points = decodePolyline(polyline);
  const path = pointsToSvgPath(points, 280, 160, 12);
  if (!path) return null;
  return (
    <svg viewBox="0 0 280 160" aria-hidden="true" style={{ width: "100%", display: "block", borderRadius: 6, background: "var(--color-surface)", marginBottom: 16 }}>
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

function ActivityDetailPanel({ activity, gear }: { activity: StravaActivity; gear?: SummaryGear }) {
  const [detail, setDetail] = useState<DetailedActivity | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const panelBodyRef = useRef<HTMLDivElement>(null);
  const triggeredEls = useRef(new WeakSet<Element>());
  const sportType = activity.sport_type || activity.type;
  const color = getSportColor(sportType);
  const emoji = getSportEmoji(sportType);
  const gearLabel = gear ? { emoji: getGearEmoji(sportType), name: gear.name } : inferredGearLabel(sportType);

  useEffect(() => {
    fetch(`/api/activity/${activity.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDetail(d); })
      .finally(() => setDetailLoading(false));
  }, [activity.id]);

  // Route map scrub parallax — scrolling the panel moves the map upward slightly
  useEffect(() => {
    if (prefersReducedMotion || !panelBodyRef.current) return;
    const scroller = document.querySelector(".panel-scroll") as HTMLElement;
    const map = panelBodyRef.current.querySelector(".detail-route-map") as HTMLElement;
    if (!scroller || !map) return;

    const ctx = gsap.context(() => {
      gsap.to(map, {
        y: -18,
        ease: "none",
        scrollTrigger: { trigger: map, scroller, start: "top top", end: "+=140", scrub: 1.4 },
      });
    });
    return () => ctx.revert();
  }, []); // eslint-disable-line

  // Section heading reveals — run on mount + when detail finishes loading (new sections appear)
  useEffect(() => {
    if (prefersReducedMotion || !panelBodyRef.current) return;
    const scroller = document.querySelector(".panel-scroll") as HTMLElement;
    if (!scroller) return;

    const sections = Array.from(panelBodyRef.current.querySelectorAll(".detail-section-header"));
    sections.filter(el => !triggeredEls.current.has(el)).forEach(el => {
      triggeredEls.current.add(el);
      gsap.from(el, {
        opacity: 0, y: 5, duration: 0.3, ease: "power2.out",
        scrollTrigger: { trigger: el, scroller, start: "top 91%", once: true },
      });
    });

    // Splits table — rows slide in from left as table scrolls into view
    const splitsTable = panelBodyRef.current.querySelector(".splits-table") as HTMLElement;
    if (splitsTable && !triggeredEls.current.has(splitsTable)) {
      triggeredEls.current.add(splitsTable);
      const rows = Array.from(splitsTable.querySelectorAll(".split-row"));
      gsap.from(rows, {
        opacity: 0, x: -10, stagger: 0.022, duration: 0.28, ease: "power2.out",
        scrollTrigger: { trigger: splitsTable, scroller, start: "top 92%", once: true },
      });
    }

    // Laps table — same treatment
    const lapsTable = panelBodyRef.current.querySelector(".laps-table") as HTMLElement;
    if (lapsTable && !triggeredEls.current.has(lapsTable)) {
      triggeredEls.current.add(lapsTable);
      const rows = Array.from(lapsTable.querySelectorAll(".lap-row"));
      gsap.from(rows, {
        opacity: 0, x: -10, stagger: 0.018, duration: 0.26, ease: "power2.out",
        scrollTrigger: { trigger: lapsTable, scroller, start: "top 92%", once: true },
      });
    }

    ScrollTrigger.refresh();
  }, [detailLoading]); // eslint-disable-line

  const d = detail ?? activity;
  const startDate = new Date(activity.start_date_local);
  const dateStr = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(startDate);
  const timeStr = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(startDate);

  const pace = formatPace(activity.distance, activity.moving_time, sportType);
  const avgSpeedKmh = activity.average_speed * 3.6;
  const maxSpeedKmh = activity.max_speed * 3.6;
  const isRide = ["Ride", "VirtualRide", "EBikeRide", "GravelRide", "MountainBikeRide"].includes(sportType);
  const isRun  = ["Run", "TrailRun", "VirtualRun"].includes(sportType);

  return (
    <div ref={panelBodyRef}>
      {/* Route map */}
      {activity.map?.summary_polyline && (
        <div className="detail-route-map" style={{ overflow: "hidden", borderRadius: 6 }}>
          <ActivityRouteMap polyline={activity.map.summary_polyline} color={color} />
        </div>
      )}

      {/* Meta */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>{dateStr}</div>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-dim)", marginTop: 2 }}>{timeStr}</div>
        {gearLabel && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
            <span aria-hidden="true">{gearLabel.emoji}</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>{gearLabel.name}</span>
          </div>
        )}
        {(activity.commute || activity.trainer) && (
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {activity.commute && <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-blue)", border: "1px solid var(--color-blue)", borderRadius: 4, padding: "1px 5px" }}>COMMUTE</span>}
            {activity.trainer && <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-text-dim)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "1px 5px" }}>TRAINER</span>}
          </div>
        )}
      </div>

      {/* Performance */}
      <DetailSection label="PERFORMANCE" />
      {activity.distance > 0 && <DetailRow label="Distance" value={formatDistance(activity.distance, sportType)} accent />}
      <DetailRow label="Moving Time" value={formatTime(activity.moving_time)} />
      {activity.elapsed_time !== activity.moving_time && <DetailRow label="Elapsed Time" value={formatTime(activity.elapsed_time)} />}
      {pace && isRun && <DetailRow label="Avg Pace" value={pace} accent />}
      {isRide && <DetailRow label="Avg Speed" value={`${new Intl.NumberFormat("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(avgSpeedKmh)} km/h`} accent />}
      {activity.max_speed > 0 && <DetailRow label="Max Speed" value={`${new Intl.NumberFormat("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(maxSpeedKmh)} km/h`} />}
      {activity.total_elevation_gain > 0 && <DetailRow label="Elevation Gain" value={formatElevation(activity.total_elevation_gain)} />}
      {activity.elev_high != null && <DetailRow label="Elev High" value={`${Math.round(activity.elev_high)} m`} />}
      {activity.elev_low != null && <DetailRow label="Elev Low" value={`${Math.round(activity.elev_low)} m`} />}
      {(d as DetailedActivity).calories != null && <DetailRow label="Calories" value={`${Math.round((d as DetailedActivity).calories!)} kcal`} />}

      {/* Heart Rate */}
      {(activity.average_heartrate || activity.max_heartrate) && (
        <>
          <DetailSection label="HEART RATE" />
          {activity.average_heartrate && <DetailRow label="Avg HR" value={`${Math.round(activity.average_heartrate)} bpm`} />}
          {activity.max_heartrate && <DetailRow label="Max HR" value={`${Math.round(activity.max_heartrate)} bpm`} />}
          {activity.suffer_score != null && activity.suffer_score > 0 && <DetailRow label="Suffer Score" value={String(activity.suffer_score)} />}
        </>
      )}

      {/* Power */}
      {(activity.average_watts || activity.kilojoules) && (
        <>
          <DetailSection label="POWER" />
          {activity.average_watts && <DetailRow label="Avg Power" value={`${Math.round(activity.average_watts)} W`} />}
          {activity.weighted_average_watts && <DetailRow label="Norm Power" value={`${Math.round(activity.weighted_average_watts)} W`} />}
          {activity.max_watts && <DetailRow label="Max Power" value={`${Math.round(activity.max_watts)} W`} />}
          {activity.kilojoules && <DetailRow label="Energy" value={`${Math.round(activity.kilojoules)} kJ`} />}
        </>
      )}

      {/* Cadence */}
      {activity.average_cadence != null && (
        <>
          <DetailSection label="CADENCE" />
          <DetailRow label="Avg Cadence" value={`${Math.round(activity.average_cadence)} rpm`} />
        </>
      )}

      {/* Social */}
      {(activity.kudos_count > 0 || (activity.achievement_count ?? 0) > 0 || (activity.pr_count ?? 0) > 0 || (activity.comment_count ?? 0) > 0) && (
        <>
          <DetailSection label="SOCIAL" />
          {activity.kudos_count > 0 && <DetailRow label="👏 Kudos" value={String(activity.kudos_count)} />}
          {(activity.achievement_count ?? 0) > 0 && <DetailRow label="🏆 Achievements" value={String(activity.achievement_count)} />}
          {(activity.pr_count ?? 0) > 0 && <DetailRow label="🥇 PRs" value={String(activity.pr_count)} />}
          {(activity.comment_count ?? 0) > 0 && <DetailRow label="💬 Comments" value={String(activity.comment_count)} />}
        </>
      )}

      {/* Device / Description (from detailed) */}
      {!detailLoading && detail && (detail.device_name || detail.description) && (
        <>
          <DetailSection label="DETAILS" />
          {detail.device_name && <DetailRow label="Device" value={detail.device_name} />}
          {detail.description && (
            <div style={{ marginTop: 8, padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Description</div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{detail.description}</div>
            </div>
          )}
        </>
      )}

      {/* Splits (runs) */}
      {!detailLoading && detail?.splits_metric && detail.splits_metric.length > 0 && (
        <>
          <DetailSection label="KM SPLITS" />
          <div className="splits-table" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr", gap: "0 10px", padding: "4px 0", borderBottom: "1px solid var(--color-border)" }}>
              {["KM", "TIME", "PACE", "ELEV"].map(h => (
                <span key={h} style={{ fontFamily: "var(--font-ui)", fontSize: 9, fontWeight: 700, color: "var(--color-text-dim)", letterSpacing: "0.08em" }}>{h}</span>
              ))}
            </div>
            {detail.splits_metric.map(s => {
              const splitPaceSecPerKm = s.moving_time / (s.distance / 1000);
              const pm = Math.floor(splitPaceSecPerKm / 60);
              const ps = Math.round(splitPaceSecPerKm % 60);
              return (
                <div key={s.split} className="split-row" style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr", gap: "0 10px", padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", fontVariantNumeric: "tabular-nums" }}>{s.split}</span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>{formatTime(s.moving_time)}</span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-orange)", fontVariantNumeric: "tabular-nums" }}>{pm}:{ps.toString().padStart(2, "0")}</span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: s.elevation_difference > 0 ? "#fdb999" : "var(--color-teal)", fontVariantNumeric: "tabular-nums" }}>
                    {s.elevation_difference > 0 ? "+" : ""}{Math.round(s.elevation_difference)}m
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Laps (rides) */}
      {!detailLoading && detail?.laps && detail.laps.length > 1 && (
        <>
          <DetailSection label="LAPS" />
          <div className="laps-table" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr", gap: "0 10px", padding: "4px 0", borderBottom: "1px solid var(--color-border)" }}>
              {["#", "DIST", "TIME", "SPEED"].map(h => (
                <span key={h} style={{ fontFamily: "var(--font-ui)", fontSize: 9, fontWeight: 700, color: "var(--color-text-dim)", letterSpacing: "0.08em" }}>{h}</span>
              ))}
            </div>
            {detail.laps.map(lap => (
              <div key={lap.id} className="lap-row" style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr", gap: "0 10px", padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", fontVariantNumeric: "tabular-nums" }}>{lap.lap_index}</span>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>{formatDistance(lap.distance, sportType)}</span>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>{formatTime(lap.moving_time)}</span>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-orange)", fontVariantNumeric: "tabular-nums" }}>
                  {new Intl.NumberFormat("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(lap.average_speed * 3.6)} km/h
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {detailLoading && (
        <div style={{ marginTop: 16, fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.06em" }}>
          LOADING DETAILS…
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
function ActivityCard({ activity, index, gear, onSelect }: {
  activity: StravaActivity;
  index: number;
  gear?: SummaryGear;
  onSelect: (activity: StravaActivity, gear?: SummaryGear) => void;
}) {
  const color = getSportColor(activity.sport_type || activity.type);
  const emoji = getSportEmoji(activity.sport_type || activity.type);
  const pace = formatPace(activity.distance, activity.moving_time, activity.sport_type || activity.type);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View details for ${activity.name}`}
      onClick={() => onSelect(activity, gear)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(activity, gear); }}
      onMouseEnter={e => !prefersReducedMotion && gsap.to(e.currentTarget, { y: -2, duration: 0.14, ease: "power2.out" })}
      onMouseLeave={e => !prefersReducedMotion && gsap.to(e.currentTarget, { y: 0, duration: 0.12, ease: "power2.out" })}
      onMouseDown={e => !prefersReducedMotion && gsap.to(e.currentTarget, { scale: 0.98, duration: 0.08 })}
      onMouseUp={e => !prefersReducedMotion && gsap.to(e.currentTarget, { scale: 1, duration: 0.14, ease: "back.out(2)" })}
      className="activity-card"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 6,
        position: "relative",
        overflow: "hidden",
        boxShadow: "inset 0 3px 5px rgba(0,0,0,.125)",
        cursor: "pointer",
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
function DayColumn({ dayIndex, date, activities, gearMap, onSelect }: {
  dayIndex: number;
  date: Date;
  activities: StravaActivity[];
  gearMap: Record<string, SummaryGear>;
  onSelect: (activity: StravaActivity, gear?: SummaryGear) => void;
}) {
  const today = isToday(date);
  const future = isFuture(date);

  return (
    <div className="day-column" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
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
            <ActivityCard key={a.id} activity={a} index={i} gear={a.gear_id ? gearMap[a.gear_id] : undefined} onSelect={onSelect} />
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
  const rowRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!suggestions.length || prefersReducedMotion) return;
    gsap.from(".suggestion-chip", {
      opacity: 0, x: -14, stagger: 0.07, duration: 0.4, ease: "power2.out",
      scrollTrigger: { trigger: rowRef.current, start: "top 93%", once: true },
    });
  }, { scope: rowRef, dependencies: [suggestions.length] });

  if (!suggestions.length) return null;

  const priorityColor: Record<string, string> = {
    high: "var(--color-orange)", medium: "#fdb999", low: "var(--color-text-muted)",
  };

  return (
    <div ref={rowRef} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {suggestions.map((s, i) => (
        <div
          key={i}
          className="suggestion-chip"
          style={{
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
  const arcRef = useRef<SVGCircleElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (!arcRef.current) return;
    const target = circumference * (1 - Math.min(score / 21, 1));
    tweenRef.current?.kill();
    if (prefersReducedMotion) {
      gsap.set(arcRef.current, { strokeDashoffset: target });
      return;
    }
    tweenRef.current = gsap.to(arcRef.current, {
      strokeDashoffset: target,
      duration: 0.85,
      ease: "back.out(1.2)",
      delay: 0.5,
    });
    return () => { tweenRef.current?.kill(); };
  }, [score, circumference]);

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
            ref={arcRef}
            cx={radius} cy={radius} r={normalizedRadius}
            fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            transform={`rotate(-90 ${radius} ${radius})`}
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
    <div className="summary-item">
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
  const containerRef = useRef<HTMLDivElement>(null);
  const headline = "STRAVA WEEK";

  useGSAP(() => {
    if (prefersReducedMotion) return;
    const tl = gsap.timeline({ delay: 0.1 });
    tl.fromTo(".login-logo",
      { opacity: 0, scale: 0.7 },
      { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }
    );
    tl.fromTo(".login-char",
      { opacity: 0, y: 20, rotationX: 80 },
      { opacity: 1, y: 0, rotationX: 0, stagger: 0.028, duration: 0.55, ease: "power3.out" },
      "-=0.25"
    );
    tl.fromTo(".login-subtitle",
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" },
      "-=0.3"
    );
    tl.fromTo(".login-cta",
      { opacity: 0, y: 10, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(1.5)" },
      "-=0.15"
    );
    tl.fromTo(".login-privacy",
      { opacity: 0 },
      { opacity: 1, duration: 0.2 },
      "-=0.1"
    );
  }, { scope: containerRef });

  return (
    <div ref={containerRef} style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32, padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="login-logo">
          <StravaIcon size={48} />
        </div>
        <h1
          aria-label={headline}
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 36, color: "var(--color-text-primary)", letterSpacing: "-0.01em", perspective: 400 } as React.CSSProperties}
        >
          {headline.split("").map((char, i) => (
            <span key={i} className="login-char" aria-hidden="true" style={{ display: "inline-block" }}>
              {char === " " ? " " : char}
            </span>
          ))}
        </h1>
        <p className="login-subtitle" style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--color-text-muted)", letterSpacing: "0.08em" }}>
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
        className="cta-btn login-cta"
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

      <p className="login-privacy" style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.05em", maxWidth: 320, textAlign: "center" }}>
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
  const [selectedActivity, setSelectedActivity] = useState<{ activity: StravaActivity; gear?: SummaryGear } | null>(null);

  const navRef = useRef<HTMLElement>(null);
  const weekHeaderRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const directionRef = useRef<"forward" | "backward">("forward");
  const isFirstCalendarEffect = useRef(true);
  const refreshSpinning = useRef(false);

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

  // Sync directionRef so calendarKey effect always has the latest direction
  useEffect(() => { directionRef.current = direction; }, [direction]);

  // Pre-hide animated elements synchronously before browser paint — eliminates flash
  useLayoutEffect(() => {
    if (hasAnimated.current || loading || !activities.length || prefersReducedMotion) return;
    gsap.set(".nav-logo", { opacity: 0, scale: 0.8 });
    gsap.set(".nav-title", { opacity: 0, x: -6 });
    gsap.set(".nav-controls", { opacity: 0, x: 8 });
    gsap.set(".week-nav-btn", { opacity: 0, scale: 0.88 });
    gsap.set(".week-headline-word", { opacity: 0, y: 14 });
    gsap.set(".week-subline", { opacity: 0 });
    gsap.set(".week-count", { opacity: 0 });
    if (summaryRef.current) gsap.set(summaryRef.current, { opacity: 0, y: 16 });
    gsap.set(".summary-item", { opacity: 0, y: 8 });
    gsap.set(".day-column", { opacity: 0, y: 12 });
    gsap.set(".activity-card", { opacity: 0, y: 10 });
  }, [loading, activities.length]); // eslint-disable-line

  // Sequenced entrance animation — fires once on first data load
  useEffect(() => {
    if (hasAnimated.current || loading || !activities.length || prefersReducedMotion) return;
    hasAnimated.current = true;

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    // Beat 1 — Nav (0.0s): logo pops, title slides, controls slide from right
    tl.to(".nav-logo",    { opacity: 1, scale: 1, duration: 0.32, ease: "back.out(2)" }, 0);
    tl.to(".nav-title",   { opacity: 1, x: 0, duration: 0.28 }, 0.06);
    tl.to(".nav-controls",{ opacity: 1, x: 0, duration: 0.24 }, 0.1);

    // Beat 2 — Week headline (0.22s): word-by-word stagger, then subline
    tl.to(".week-nav-btn",      { opacity: 1, scale: 1, stagger: 0.08, duration: 0.22, ease: "back.out(1.5)" }, 0.22);
    tl.to(".week-headline-word",{ opacity: 1, y: 0, stagger: 0.055, duration: 0.38, ease: "power3.out" }, 0.26);
    tl.to(".week-subline",      { opacity: 1, duration: 0.22 }, 0.52);
    tl.to(".week-count",        { opacity: 1, duration: 0.2 }, 0.56);

    // Beat 3 — Summary bar (0.42s): container rises, then items stagger across
    if (summaryRef.current) tl.to(summaryRef.current, { opacity: 1, y: 0, duration: 0.32 }, 0.42);
    tl.to(".summary-item", { opacity: 1, y: 0, stagger: 0.048, duration: 0.24 }, 0.54);

    // Beat 4 — Calendar (0.62s): columns land left-to-right, cards follow
    tl.to(".day-column",   { opacity: 1, y: 0, stagger: 0.042, duration: 0.28 }, 0.62);
    tl.to(".activity-card",{ opacity: 1, y: 0, stagger: 0.032, duration: 0.22 }, 0.74);
  }, [loading, activities.length]); // eslint-disable-line

  // Calendar enter animation on week navigation
  useEffect(() => {
    if (isFirstCalendarEffect.current) { isFirstCalendarEffect.current = false; return; }
    if (!calendarRef.current || prefersReducedMotion) return;
    const xFrom = directionRef.current === "forward" ? 40 : -40;
    gsap.fromTo(calendarRef.current,
      { x: xFrom, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.25, ease: "power2.out" }
    );
  }, [calendarKey]); // eslint-disable-line

  const goWeek = useCallback((delta: number) => {
    const dir = delta < 0 ? "backward" : "forward";
    setDirection(dir);
    directionRef.current = dir;
    const doNav = () => { setCalendarKey(k => k + 1); setWeekOffset(w => w + delta); };
    if (calendarRef.current && !prefersReducedMotion) {
      gsap.to(calendarRef.current, { x: delta > 0 ? -40 : 40, opacity: 0, duration: 0.18, ease: "power2.in", onComplete: doNav });
    } else {
      doNav();
    }
  }, [setWeekOffset]);

  const goToday = useCallback(() => {
    const dir = weekOffset < 0 ? "forward" : "backward";
    setDirection(dir);
    directionRef.current = dir;
    const doNav = () => { setCalendarKey(k => k + 1); setWeekOffset(0); };
    if (calendarRef.current && !prefersReducedMotion) {
      gsap.to(calendarRef.current, { x: dir === "forward" ? -40 : 40, opacity: 0, duration: 0.18, ease: "power2.in", onComplete: doNav });
    } else {
      doNav();
    }
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

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", padding: "0 0 48px" }}>
      <nav
        ref={navRef}
        aria-label="Site navigation"
        style={{
          borderBottom: "1px solid var(--color-border)",
          padding: "12px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: "var(--color-bg)", zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="nav-logo" style={{ display: "flex", flexShrink: 0 }}>
            <StravaIcon size={28} />
          </span>
          <span className="nav-title" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--color-text-primary)", letterSpacing: "0.02em" }}>
            STRAVA WEEK
          </span>
        </div>

        <div className="nav-controls" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={e => {
              loadActivities();
              if (!prefersReducedMotion) {
                const btn = e.currentTarget;
                refreshSpinning.current = true;
                gsap.killTweensOf(btn, "rotate");
                gsap.fromTo(btn, { rotate: 0 }, { rotate: 360, duration: 0.52, ease: "power2.inOut",
                  onComplete: () => { gsap.set(btn, { rotate: 0 }); refreshSpinning.current = false; }
                });
              }
            }}
            onMouseEnter={e => { if (!prefersReducedMotion && !refreshSpinning.current) gsap.to(e.currentTarget, { rotate: 30, duration: 0.18, ease: "power2.out" }); }}
            onMouseLeave={e => { if (!prefersReducedMotion && !refreshSpinning.current) gsap.to(e.currentTarget, { rotate: 0, duration: 0.14, ease: "power2.out" }); }}
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
      {selectedActivity && (
        <Panel title={selectedActivity.activity.name} onClose={() => setSelectedActivity(null)}>
          <ActivityDetailPanel activity={selectedActivity.activity} gear={selectedActivity.gear} />
        </Panel>
      )}

      <main id="main" style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>
        {/* Week header */}
        <div ref={weekHeaderRef} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => goWeek(-1)}
              aria-label="Previous week"
              className="week-nav-btn"
              onMouseEnter={e => !prefersReducedMotion && gsap.to(e.currentTarget, { scale: 1.12, duration: 0.12, ease: "power2.out" })}
              onMouseLeave={e => !prefersReducedMotion && gsap.to(e.currentTarget, { scale: 1, duration: 0.1, ease: "power2.out" })}
              onMouseDown={e => !prefersReducedMotion && gsap.to(e.currentTarget, { scale: 0.88, duration: 0.08 })}
              onMouseUp={e => !prefersReducedMotion && gsap.to(e.currentTarget, { scale: 1, duration: 0.14, ease: "back.out(2)" })}
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>

            <div>
              <h1
                aria-label={weekLabel}
                style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--color-text-primary)", lineHeight: 1.1 } as React.CSSProperties}
              >
                {weekLabel.split(" ").map((word, i, arr) => (
                  <span key={`${word}-${i}`} className="week-headline-word" style={{ display: "inline-block" }}>
                    {word}{i < arr.length - 1 ? " " : ""}
                  </span>
                ))}
              </h1>
              {isCurrentWeek && (
                <div suppressHydrationWarning className="week-subline" style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                  {formatWeekLabel(weekStart, weekEnd)}
                </div>
              )}
            </div>

            <button
              onClick={() => goWeek(1)}
              disabled={weekOffset >= 0}
              aria-label="Next week"
              className="week-nav-btn"
              onMouseEnter={e => { if (!prefersReducedMotion && weekOffset < 0) gsap.to(e.currentTarget, { scale: 1.12, duration: 0.12, ease: "power2.out" }); }}
              onMouseLeave={e => { if (!prefersReducedMotion && weekOffset < 0) gsap.to(e.currentTarget, { scale: 1, duration: 0.1, ease: "power2.out" }); }}
              onMouseDown={e => { if (!prefersReducedMotion && weekOffset < 0) gsap.to(e.currentTarget, { scale: 0.88, duration: 0.08 }); }}
              onMouseUp={e => { if (!prefersReducedMotion && weekOffset < 0) gsap.to(e.currentTarget, { scale: 1, duration: 0.14, ease: "back.out(2)" }); }}
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
                onMouseEnter={e => !prefersReducedMotion && gsap.to(e.currentTarget, { scale: 1.06, duration: 0.12, ease: "power2.out" })}
                onMouseLeave={e => !prefersReducedMotion && gsap.to(e.currentTarget, { scale: 1, duration: 0.1, ease: "power2.out" })}
                onMouseDown={e => !prefersReducedMotion && gsap.to(e.currentTarget, { scale: 0.92, duration: 0.08 })}
                onMouseUp={e => !prefersReducedMotion && gsap.to(e.currentTarget, { scale: 1, duration: 0.14, ease: "back.out(2)" })}
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
            className="week-count"
            style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--color-text-dim)", letterSpacing: "0.06em" }}
          >
            {loading ? "LOADING…" : `${activityCount} ACTIVIT${activityCount !== 1 ? "IES" : "Y"}`}
          </div>
        </div>

        {/* Weekly summary + suggestions */}
        {!loading && activities.length > 0 && (
          <div ref={summaryRef} style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
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
            <div ref={calendarRef} key={calendarKey} className="calendar-grid">
              {days.map((date, i) => {
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                return (
                  <DayColumn key={key} dayIndex={i} date={date} activities={activitiesByDay[key] ?? []} gearMap={gearMap} onSelect={(a, g) => setSelectedActivity({ activity: a, gear: g })} />
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
