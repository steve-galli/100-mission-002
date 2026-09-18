import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strava Week",
  description: "Your personal Strava activity calendar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
