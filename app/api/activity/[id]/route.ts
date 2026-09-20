import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveActiveProfile, PROFILES_COOKIE, ACTIVE_COOKIE } from "@/lib/strava";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${id}`,
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );

  if (!res.ok) return NextResponse.json({ error: "fetch_failed" }, { status: res.status });
  return NextResponse.json(await res.json());
}
