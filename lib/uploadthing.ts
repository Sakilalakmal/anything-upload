import { generateReactHelpers, generateUploadDropzone } from "@uploadthing/react"

import type { UploadRouter } from "@/app/api/uploadthing/core"

export const UploadDropzone = generateUploadDropzone<UploadRouter>()
export const { useUploadThing } = generateReactHelpers<UploadRouter>()
