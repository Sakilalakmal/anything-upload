import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { Navbar } from "@/components/navbar"
import { NotificationsProvider } from "@/components/notifications/notifications-provider"
import { Toaster } from "@/components/ui/sonner"
import { getCurrentUser } from "@/lib/auth-guards"
import { getUnreadCount } from "@/lib/data/notifications"

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
  const userPromise = getCurrentUser()

  return (
    <RootLayoutContent userPromise={userPromise}>{children}</RootLayoutContent>
  )
}

async function RootLayoutContent({
  children,
  userPromise,
}: Readonly<{
  children: React.ReactNode
  userPromise: ReturnType<typeof getCurrentUser>
}>) {
  const user = await userPromise
  const initialUnreadCount = user ? await getUnreadCount(user.id) : 0

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NotificationsProvider initialUnreadCount={initialUnreadCount}>
          <div className="min-h-screen bg-muted/30">
            <Navbar user={user} />
            <main className="mx-auto w-full max-w-5xl px-4 py-10">{children}</main>
          </div>
        </NotificationsProvider>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  )
}
