import type { Metadata } from "next"
import localFont from "next/font/local"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

// Self-hosted to avoid runtime/build fetches to fonts.gstatic.com (blocked by
// the client's Azure Firewall URL whitelist). Files are latin-subset variable
// woff2 committed under app/fonts.
const fontSans = localFont({
  src: "./fonts/montserrat-variable.woff2",
  variable: "--font-sans",
  display: "swap",
})

const fontMono = localFont({
  src: "./fonts/geist-mono-variable.woff2",
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "DORA Dashboard",
  description:
    "Self-hosted delivery-intelligence portal — DORA-4 + extended metrics from GitHub & Jira for regulated environments.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
