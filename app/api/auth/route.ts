import { NextResponse } from "next/server";

export function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;

  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", clientId!);
  url.searchParams.set("redirect_uri", redirectUri!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "activity:read_all,profile:read_all");

  return NextResponse.redirect(url.toString());
}
