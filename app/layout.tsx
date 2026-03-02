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
  description: "Short-form video platform with a clean TikTok-inspired browsing experience",
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
      <body className={`${geistSans.variable} ${geistMono.variable} bg-[#fafafa] font-sans text-foreground antialiased`}>
        <NotificationsProvider initialUnreadCount={initialUnreadCount} sessionUserId={user?.id ?? null}>
          <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(250,250,250,1)_45%,_rgba(245,245,245,1))]">
            <Navbar user={user} />
            <main className="mx-auto w-full max-w-[1280px] px-3 pb-10 pt-4 sm:px-4 lg:px-6 lg:pt-6">{children}</main>
          </div>
        </NotificationsProvider>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  )
}
