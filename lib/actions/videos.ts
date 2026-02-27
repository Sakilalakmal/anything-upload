"use server"

import { VideoStatus, VideoVisibility } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { requireUser } from "@/lib/auth-guards"
import { prisma } from "@/lib/prisma"
import { createVideoAfterUploadSchema } from "@/lib/validations/videos"

type CreateVideoAfterUploadResult =
  | {
      success: true
      videoId: string
    }
  | {
      success: false
      error: string
      fieldErrors?: {
        title?: string[]
        description?: string[]
        videoUrl?: string[]
      }
    }

export async function createVideoAfterUpload(input: unknown): Promise<CreateVideoAfterUploadResult> {
  const user = await requireUser()
  const parsed = createVideoAfterUploadSchema.safeParse(input)

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors

    return {
      success: false,
      error: "Please fix the highlighted fields and try again.",
      fieldErrors: {
        title: fieldErrors.title,
        description: fieldErrors.description,
        videoUrl: fieldErrors.videoUrl,
      },
    }
  }

  if (parsed.data.uploadedBy !== user.id) {
    return {
      success: false,
      error: "Upload ownership mismatch. Please upload again.",
    }
  }

  try {
    const video = await prisma.video.create({
      data: {
        userId: user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        videoUrl: parsed.data.videoUrl,
        status: VideoStatus.READY,
        visibility: VideoVisibility.PUBLIC,
      },
      select: {
        id: true,
      },
    })

    revalidatePath("/profile")

    return {
      success: true,
      videoId: video.id,
    }
  } catch {
    return {
      success: false,
      error: "Unable to save video right now. Please try again.",
    }
  }
}
