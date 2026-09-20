import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strava Week",
  description: "Your personal Strava activity calendar",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <head>
        <link rel="preload" href="/fonts/Boathouse-700.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/BoathouseCondensed-700.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
