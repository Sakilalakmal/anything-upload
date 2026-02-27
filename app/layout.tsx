import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { Navbar } from "@/components/navbar"
import { Toaster } from "@/components/ui/sonner"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Anything",
  description: "Phase 1 authentication and user accounts",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-muted/30">
          <Navbar />
          <main className="mx-auto w-full max-w-5xl px-4 py-10">{children}</main>
        </div>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  )
}
