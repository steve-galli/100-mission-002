import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchAthlete, fetchWeekActivities, getWeekRange,
  resolveActiveProfile, PROFILES_COOKIE, ACTIVE_COOKIE,
} from "@/lib/strava";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const result = await resolveActiveProfile(
    cookieStore.get(PROFILES_COOKIE)?.value,
    cookieStore.get(ACTIVE_COOKIE)?.value,
    cookieStore.get("strava_token")?.value,
  );
  if (!result) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { tokenData, profiles, refreshed } = result;
  if (refreshed) {
    cookieStore.set(PROFILES_COOKIE, JSON.stringify(profiles), COOKIE_OPTS);
    cookieStore.set(ACTIVE_COOKIE, String(tokenData.athlete.id), COOKIE_OPTS);
  }

  const { searchParams } = new URL(req.url);
  const weekParam = searchParams.get("week");
  const targetDate = weekParam ? new Date(weekParam) : new Date();
  const { start, end } = getWeekRange(targetDate);

  try {
    const [activities, athlete] = await Promise.all([
      fetchWeekActivities(tokenData.access_token, start, end),
      fetchAthlete(tokenData.access_token),
    ]);
    return NextResponse.json({ activities, athlete, weekStart: start.toISOString(), weekEnd: end.toISOString() });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
