import { NextRequest, NextResponse } from "next/server";
import { clientIdForN } from "@/lib/strava";

export function GET(req: NextRequest) {
  const n = parseInt(req.nextUrl.searchParams.get("n") ?? "1", 10);
  const clientId = clientIdForN(n);
  const redirectUri = process.env.STRAVA_REDIRECT_URI!;

  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "force");
  url.searchParams.set("scope", "activity:read_all,profile:read_all");
  url.searchParams.set("state", `n:${n}`);

  return NextResponse.redirect(url.toString());
}
