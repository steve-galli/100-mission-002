import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { refreshToken, TokenData } from "@/lib/strava";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cookieStore = await cookies();
  const raw = cookieStore.get("strava_token")?.value;
  if (!raw) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let tokenData: TokenData = JSON.parse(raw);

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

  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${id}`,
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );

  if (!res.ok) return NextResponse.json({ error: "fetch_failed" }, { status: res.status });
  return NextResponse.json(await res.json());
}
