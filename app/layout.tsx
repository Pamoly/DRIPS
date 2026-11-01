import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DRIPS — SEO Intelligence Platform",
    template: "%s · DRIPS",
  },
  description:
    "All-in-one keyword research, site audits, competitor analysis, AI content optimization and real-time rank tracking with Google Search Console.",
  applicationName: "DRIPS",
  openGraph: {
    title: "DRIPS — SEO Intelligence Platform",
    description: "Keyword research, audits, rank tracking and AI content optimization in one workspace.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#080B10",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem('drips-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
