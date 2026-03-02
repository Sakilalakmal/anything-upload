import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { Navbar } from "@/components/navbar"
import { NotificationsProvider } from "@/components/notifications/notifications-provider"
import { Toaster } from "@/components/ui/sonner"
import { getCurrentUser } from "@/lib/auth-guards"
import { getUnreadCount } from "@/lib/data/notifications"
import { isPrismaDatabaseConnectivityError } from "@/lib/prisma-errors"

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()
  let initialUnreadCount = 0

  if (user) {
    try {
      initialUnreadCount = await getUnreadCount(user.id)
    } catch (error) {
      if (!isPrismaDatabaseConnectivityError(error)) {
        throw error
      }
    }
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NotificationsProvider initialUnreadCount={initialUnreadCount} sessionUserId={user?.id ?? null}>
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
