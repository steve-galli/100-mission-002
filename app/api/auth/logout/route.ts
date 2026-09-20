import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PROFILES_COOKIE, ACTIVE_COOKIE } from "@/lib/strava";

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete(PROFILES_COOKIE);
  cookieStore.delete(ACTIVE_COOKIE);
  cookieStore.delete("strava_token");
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"));
}
