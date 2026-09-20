import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, parseProfiles, PROFILES_COOKIE, ACTIVE_COOKIE } from "@/lib/strava";
import { cookies } from "next/headers";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?error=denied", req.url));
  }

  try {
    // Read which credential set was used from the OAuth state param
    const stateRaw = searchParams.get("state") ?? "";
    const clientN = stateRaw.startsWith("n:") ? parseInt(stateRaw.slice(2), 10) : 1;

    const tokenData = { ...await exchangeCode(code, clientN), _client_n: clientN };
    const cookieStore = await cookies();

    // Merge into profiles array (add or update by athlete ID)
    const existing = parseProfiles(cookieStore.get(PROFILES_COOKIE)?.value);
    const idx = existing.findIndex(p => p.athlete.id === tokenData.athlete.id);
    const profiles = idx >= 0
      ? existing.map((p, i) => i === idx ? tokenData : p)
      : [...existing, tokenData];

    cookieStore.set(PROFILES_COOKIE, JSON.stringify(profiles), COOKIE_OPTS);
    cookieStore.set(ACTIVE_COOKIE, String(tokenData.athlete.id), COOKIE_OPTS);

    return NextResponse.redirect(new URL("/", req.url));
  } catch {
    return NextResponse.redirect(new URL("/?error=token", req.url));
  }
}
