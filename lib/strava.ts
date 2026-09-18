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
