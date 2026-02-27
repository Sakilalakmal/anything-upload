"use client"

import { Pause, Play, Volume2, VolumeX } from "lucide-react"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MUTE_PREFERENCE_KEY = "anything:feed-player-muted"
const MUTE_PREFERENCE_EVENT = "anything:feed-player-muted-change"

type VideoPlayerProps = {
  src: string
  poster?: string | null
  title: string
  className?: string
}

export function VideoPlayer({ src, poster, title, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [isInView, setIsInView] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const isMuted = useSyncExternalStore(
    subscribeToMutePreference,
    getMutePreferenceSnapshot,
    getMutePreferenceServerSnapshot
  )

  useEffect(() => {
    const videoElement = videoRef.current

    if (!videoElement) {
      return
    }

    videoElement.muted = isMuted
  }, [isMuted])

  useEffect(() => {
    const observedElement = containerRef.current

    if (!observedElement) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        setIsInView(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.6))
      },
      {
        threshold: [0.2, 0.6, 0.9],
      }
    )

    observer.observe(observedElement)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const videoElement = videoRef.current

    if (!videoElement) {
      return
    }

    if (!isInView) {
      videoElement.pause()
      return
    }

    const playPromise = videoElement.play()
    if (playPromise) {
      playPromise.catch(() => {
        setIsPlaying(!videoElement.paused)
      })
    }
  }, [isInView])

  useEffect(() => {
    const videoElement = videoRef.current

    if (!videoElement) {
      return
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    videoElement.addEventListener("play", handlePlay)
    videoElement.addEventListener("pause", handlePause)

    return () => {
      videoElement.removeEventListener("play", handlePlay)
      videoElement.removeEventListener("pause", handlePause)
    }
  }, [])

  const togglePlayback = useCallback(() => {
    const videoElement = videoRef.current

    if (!videoElement) {
      return
    }

    if (videoElement.paused) {
      const playPromise = videoElement.play()
      if (playPromise) {
        playPromise.catch(() => {
          setIsPlaying(!videoElement.paused)
        })
      }
      return
    }

    videoElement.pause()
  }, [])

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted
    window.localStorage.setItem(MUTE_PREFERENCE_KEY, String(nextMuted))
    window.dispatchEvent(new Event(MUTE_PREFERENCE_EVENT))
  }, [isMuted])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault()
        togglePlayback()
        return
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault()
        toggleMute()
      }
    },
    [toggleMute, togglePlayback]
  )

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn(
        "group relative mx-auto w-full max-w-[23rem] rounded-2xl border border-border/60 bg-black shadow-sm outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring/60",
        className
      )}
      onKeyDown={handleKeyDown}
      aria-label={`Video player for ${title}`}
    >
      <AspectRatio ratio={9 / 16} className="overflow-hidden rounded-2xl">
        <video
          ref={videoRef}
          className="size-full object-cover"
          src={src}
          poster={poster ?? undefined}
          playsInline
          muted={isMuted}
          loop
          preload="metadata"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20 opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            type="button"
            size="icon-lg"
            variant="secondary"
            onClick={togglePlayback}
            className={cn(
              "rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-black/70",
              isPlaying
                ? "scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
                : "opacity-100"
            )}
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
          </Button>
        </div>
        <div className="absolute right-3 bottom-3">
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            onClick={toggleMute}
            className="rounded-full border border-white/20 bg-black/60 text-white shadow-md backdrop-blur-sm transition-transform duration-200 hover:scale-105 hover:bg-black/70"
            aria-label={isMuted ? "Unmute video" : "Mute video"}
          >
            {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
        </div>
      </AspectRatio>
    </div>
  )
}

function subscribeToMutePreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(MUTE_PREFERENCE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(MUTE_PREFERENCE_EVENT, onStoreChange)
  }
}

function getMutePreferenceSnapshot() {
  return window.localStorage.getItem(MUTE_PREFERENCE_KEY) !== "false"
}

function getMutePreferenceServerSnapshot() {
  return true
}
