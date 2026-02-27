import { z } from "zod"
import type { FileSize } from "@uploadthing/shared"
import { UploadThingError } from "uploadthing/server"
import { createUploadthing, type FileRouter } from "uploadthing/next"

import { auth } from "@/lib/auth"

const fileSizeSchema = z
  .string()
  .regex(/^(1|2|4|8|16|32|64|128|256|512|1024)(B|KB|MB|GB)$/)

const maxVideoFileSize = fileSizeSchema.catch("128MB").parse(process.env.UPLOADTHING_VIDEO_MAX_FILE_SIZE) as FileSize

const f = createUploadthing()

export const uploadRouter = {
  videoUploader: f({
    "video/mp4": {
      maxFileCount: 1,
      maxFileSize: maxVideoFileSize,
    },
    "video/webm": {
      maxFileCount: 1,
      maxFileSize: maxVideoFileSize,
    },
    "video/quicktime": {
      maxFileCount: 1,
      maxFileSize: maxVideoFileSize,
    },
  })
    .middleware(async ({ req }) => {
      const session = await auth.api.getSession({
        headers: req.headers,
      })

      if (!session?.user?.id) {
        throw new UploadThingError({
          code: "FORBIDDEN",
          message: "You must be signed in to upload videos.",
        })
      }

      return {
        userId: session.user.id,
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.userId,
        videoUrl: file.ufsUrl,
      }
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
