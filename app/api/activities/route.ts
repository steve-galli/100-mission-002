import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchAthlete, fetchWeekActivities, getWeekRange, refreshToken, TokenData } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("strava_token")?.value;
  if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let tokenData: TokenData = JSON.parse(raw);

  // Refresh token if expired
  if (Date.now() / 1000 > tokenData.expires_at - 300) {
    try {
      tokenData = await refreshToken(tokenData.refresh_token);
      cookieStore.set("strava_token", JSON.stringify(tokenData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    } catch {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const weekParam = searchParams.get("week"); // ISO date string for any day in the week
  const targetDate = weekParam ? new Date(weekParam) : new Date();
  const { start, end } = getWeekRange(targetDate);

  try {
    const [activities, athlete] = await Promise.all([
      fetchWeekActivities(tokenData.access_token, start, end),
      fetchAthlete(tokenData.access_token),
    ]);
    return NextResponse.json({
      activities,
      athlete,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
