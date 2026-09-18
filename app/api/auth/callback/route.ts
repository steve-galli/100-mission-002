import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/strava";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?error=denied", req.url));
  }

  try {
    const tokenData = await exchangeCode(code);
    const cookieStore = await cookies();

    cookieStore.set("strava_token", JSON.stringify(tokenData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return NextResponse.redirect(new URL("/", req.url));
  } catch {
    return NextResponse.redirect(new URL("/?error=token", req.url));
  }
}
