export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number;       // metres
  moving_time: number;    // seconds
  elapsed_time: number;   // seconds
  total_elevation_gain: number; // metres
  average_speed: number;  // m/s
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  kudos_count: number;
  achievement_count: number;
  map?: { summary_polyline: string };
}

export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile_medium: string;
  profile: string;
  city: string;
  country: string;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: StravaAthlete;
}

export async function exchangeCode(code: string): Promise<TokenData> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("Token exchange failed");
  return res.json();
}

export async function refreshToken(refresh_token: string): Promise<TokenData> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return res.json();
}

export async function fetchWeekActivities(
  accessToken: string,
  weekStart: Date,
  weekEnd: Date
): Promise<StravaActivity[]> {
  const after = Math.floor(weekStart.getTime() / 1000);
  const before = Math.floor(weekEnd.getTime() / 1000);
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch activities");
  return res.json();
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

export function formatDistance(metres: number, type: string): string {
  if (metres === 0) return "—";
  const swim = ["Swim", "OpenWaterSwim"].includes(type);
  if (swim) return `${metres.toFixed(0)}m`;
  const km = metres / 1000;
  return km >= 10 ? `${km.toFixed(1)}km` : `${km.toFixed(2)}km`;
}

export function formatTime(seconds: number): string {
  if (seconds === 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function formatElevation(metres: number): string {
  if (metres === 0) return "—";
  return `${Math.round(metres)}m`;
}

export function formatPace(metres: number, seconds: number, type: string): string {
  if (metres === 0 || seconds === 0) return "—";
  const runs = ["Run", "TrailRun", "VirtualRun"];
  const rides = ["Ride", "VirtualRide", "EBikeRide", "GravelRide", "MountainBikeRide"];
  if (runs.includes(type)) {
    const secPerKm = seconds / (metres / 1000);
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${s.toString().padStart(2, "0")}/km`;
  }
  if (rides.includes(type)) {
    const kmh = (metres / 1000) / (seconds / 3600);
    return `${kmh.toFixed(1)} km/h`;
  }
  return "";
}

export const SPORT_EMOJI: Record<string, string> = {
  Run: "🏃",
  TrailRun: "🏔",
  VirtualRun: "🏃",
  Ride: "🚴",
  VirtualRide: "🚴",
  EBikeRide: "⚡",
  GravelRide: "🚵",
  MountainBikeRide: "🚵",
  Swim: "🏊",
  OpenWaterSwim: "🌊",
  Walk: "🚶",
  Hike: "🥾",
  WeightTraining: "🏋️",
  Workout: "💪",
  CrossFit: "💪",
  Yoga: "🧘",
  Soccer: "⚽",
  Tennis: "🎾",
  Kayaking: "🛶",
  AlpineSki: "⛷️",
  BackcountrySki: "🎿",
  NordicSki: "🎿",
  Snowboard: "🏂",
  Rowing: "🚣",
  Golf: "⛳",
  Surfing: "🏄",
  Skateboard: "🛹",
};

export function getSportEmoji(type: string): string {
  return SPORT_EMOJI[type] ?? "⚡";
}

// Whoop-style weekly strain score (0–21 scale)
// Based on moving time × sport intensity × suffer score boost × elevation bonus
const SPORT_LOAD: Record<string, number> = {
  Run: 8.5, TrailRun: 9.5, VirtualRun: 8,
  Ride: 6, VirtualRide: 5.5, EBikeRide: 4, GravelRide: 7, MountainBikeRide: 7.5,
  Swim: 7.5, OpenWaterSwim: 8.5,
  Walk: 2.5, Hike: 4,
  WeightTraining: 5.5, Workout: 6.5, CrossFit: 9, Yoga: 2,
};

export function calculateWeeklyStrain(activities: StravaActivity[]): number {
  let totalLoad = 0;

  activities.forEach((a) => {
    const type = a.sport_type || a.type;
    const baseLoad = SPORT_LOAD[type] ?? 5;
    const hours = a.moving_time / 3600;
    let load = hours * baseLoad;

    // Suffer score boosts intensity estimate (0-100+ → up to +40% load)
    if (a.suffer_score && a.suffer_score > 0) {
      load *= Math.min(1.4, 1 + a.suffer_score / 250);
    }

    // Elevation adds load for runs and rides (per 500m elev ≈ +8%)
    if (a.total_elevation_gain > 50) {
      load *= 1 + Math.min(0.4, a.total_elevation_gain / 5000);
    }

    totalLoad += load;
  });

  // Calibration: HONC 41 week (6h MTB epic + 2h group ride + swim/yoga) → ~18.5 STRENUOUS.
  // ALL OUT (21) reserved for a full race week with daily hard sessions.
  const MAX_LOAD = 100;
  return Math.min(21, Math.round((totalLoad / MAX_LOAD) * 21 * 10) / 10);
}

export interface Suggestion {
  icon: string;
  text: string;
  priority: "high" | "medium" | "low";
}

export function generateSuggestions(activities: StravaActivity[], strain: number): Suggestion[] {
  const suggestions: Suggestion[] = [];

  const types = activities.map(a => a.sport_type || a.type);
  const totalElev = activities.reduce((s, a) => s + a.total_elevation_gain, 0);

  const hasStrength = types.some(t => ["WeightTraining", "CrossFit", "Workout"].includes(t));
  const hasYoga     = types.some(t => ["Yoga", "Pilates"].includes(t));
  const hasSwim     = types.some(t => ["Swim", "OpenWaterSwim"].includes(t));
  const hasRun      = types.some(t => ["Run", "TrailRun", "VirtualRun"].includes(t));
  const hasRide     = types.some(t => ["Ride", "VirtualRide", "MountainBikeRide", "GravelRide", "EBikeRide"].includes(t));

  const hasEpicEffort  = activities.some(a => a.moving_time > 14400);  // 4h+
  const hasBigEffort   = activities.some(a => a.moving_time > 7200);   // 2h+

  // Back-to-back hard days
  const activeDates = [...new Set(activities.map(a => a.start_date_local.slice(0, 10)))].sort();
  const backToBack = activeDates.some((d, i) => {
    if (i === 0) return false;
    return (new Date(d).getTime() - new Date(activeDates[i - 1]).getTime()) === 86400000;
  });

  // Rest days
  if (strain >= 18) {
    suggestions.push({ icon: "🛌", text: "Take 2 full rest days before your next hard session", priority: "high" });
  } else if (strain >= 14) {
    suggestions.push({ icon: "😴", text: "Schedule 1 rest day before your next intense effort", priority: "high" });
  }

  // Epic effort recovery
  if (hasEpicEffort) {
    suggestions.push({ icon: "🦵", text: "Allow 48–72h for legs to recover from your long ride", priority: "high" });
  } else if (hasBigEffort) {
    suggestions.push({ icon: "⏸️", text: "24h easy recovery before your next hard session", priority: "medium" });
  }

  // High elevation → yoga/stretching
  if (totalElev > 1500 && !hasYoga) {
    suggestions.push({ icon: "🧘", text: "Yoga or stretching recommended after this much climbing", priority: "medium" });
  } else if (hasBigEffort && !hasYoga) {
    suggestions.push({ icon: "🧘", text: "Add a yoga session to support recovery", priority: "low" });
  }

  // Strength gap
  if (!hasStrength) {
    suggestions.push({ icon: "🏋️", text: "Add 1 strength session next week to build resilience", priority: "medium" });
  }

  // Back-to-back without recovery
  if (backToBack && strain >= 14) {
    suggestions.push({ icon: "🔄", text: "Add an easy active recovery day between hard efforts", priority: "medium" });
  }

  // Swimming as recovery
  if (!hasSwim && strain >= 14) {
    suggestions.push({ icon: "🏊", text: "A recovery swim is ideal after a high-strain week", priority: "low" });
  }

  // Cross-training
  if (hasRide && !hasRun && strain < 16) {
    suggestions.push({ icon: "🏃", text: "Mix in a short run to work different muscle groups", priority: "low" });
  }

  // Low strain nudge
  if (strain < 8 && activities.length > 0) {
    suggestions.push({ icon: "📈", text: "Low strain this week — room to increase intensity", priority: "low" });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return suggestions.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 3);
}

export function strainLabel(score: number): { label: string; color: string } {
  if (score < 8)  return { label: "RECOVERY",  color: "#129398" };
  if (score < 12) return { label: "LIGHT",     color: "#004ca6" };
  if (score < 15) return { label: "MODERATE",  color: "#fdb999" };
  if (score < 18) return { label: "STRENUOUS", color: "#fc5200" };
  return               { label: "ALL OUT",    color: "#df2626" };
}

export const SPORT_COLOR: Record<string, string> = {
  Run: "#fc5200",
  TrailRun: "#fc5200",
  VirtualRun: "#fc5200",
  Ride: "#004ca6",
  VirtualRide: "#004ca6",
  EBikeRide: "#004ca6",
  GravelRide: "#004ca6",
  MountainBikeRide: "#004ca6",
  Swim: "#129398",
  OpenWaterSwim: "#129398",
  Walk: "#918e89",
  Hike: "#918e89",
  WeightTraining: "#c94100",
  Workout: "#c94100",
};

export function getSportColor(type: string): string {
  return SPORT_COLOR[type] ?? "#fc5200";
}
