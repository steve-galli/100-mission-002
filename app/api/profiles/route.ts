import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseProfiles, PROFILES_COOKIE, ACTIVE_COOKIE } from "@/lib/strava";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

// GET — return public profile info only (no tokens)
export async function GET() {
  const cookieStore = await cookies();
  const profiles = parseProfiles(cookieStore.get(PROFILES_COOKIE)?.value);

  // Backward compat: include legacy single-token profile
  if (!profiles.length) {
    const legacy = cookieStore.get("strava_token")?.value;
    if (legacy) {
      try {
        const t = JSON.parse(legacy);
        profiles.push(t);
      } catch { /* ignore */ }
    }
  }

  const activeId = cookieStore.get(ACTIVE_COOKIE)?.value
    ?? (profiles[0] ? String(profiles[0].athlete.id) : undefined);

  return NextResponse.json(
    profiles.map(p => ({
      id: p.athlete.id,
      firstname: p.athlete.firstname,
      lastname: p.athlete.lastname,
      profile_medium: p.athlete.profile_medium,
      isActive: String(p.athlete.id) === activeId,
    }))
  );
}

// POST — switch active profile
export async function POST(req: NextRequest) {
  const { athlete_id } = await req.json() as { athlete_id: number };
  const cookieStore = await cookies();

  const profiles = parseProfiles(cookieStore.get(PROFILES_COOKIE)?.value);
  const found = profiles.find(p => p.athlete.id === athlete_id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  cookieStore.set(ACTIVE_COOKIE, String(athlete_id), COOKIE_OPTS);
  return NextResponse.json({ ok: true });
}
