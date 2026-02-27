"use client"

import "@uploadthing/react/styles.css"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { createVideoAfterUpload } from "@/lib/actions/videos"
import { UploadDropzone } from "@/lib/uploadthing"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"

const uploadVideoFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160, "Title must be 160 characters or less."),
  description: z.string().trim().max(2000, "Description must be 2000 characters or less.").optional(),
})

type UploadVideoFormValues = z.infer<typeof uploadVideoFormSchema>
type UploadState = "idle" | "uploading" | "uploaded" | "error"
type UploadedFileState = {
  uploadedBy: string
  videoUrl: string
}

export function VideoUploadForm() {
  const router = useRouter()
  const [isSubmitting, startTransition] = useTransition()
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<UploadedFileState | null>(null)

  const form = useForm<UploadVideoFormValues>({
    resolver: zodResolver(uploadVideoFormSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  })

  const canSubmit = uploadState === "uploaded" && Boolean(uploadedFile) && !isSubmitting

  const uploadStateLabel = useMemo(() => {
    if (uploadState === "uploading") {
      return `Uploading video... ${uploadProgress}%`
    }

    if (uploadState === "uploaded") {
      return "Upload complete. Publish when ready."
    }

    if (uploadState === "error") {
      return "Upload failed. Please try again."
    }

    return "Drop your video to start uploading."
  }, [uploadProgress, uploadState])

  const onSubmit = (values: UploadVideoFormValues) => {
    if (!uploadedFile) {
      toast.error("Upload a video before publishing.")
      return
    }

    startTransition(async () => {
      const result = await createVideoAfterUpload({
        title: values.title,
        description: values.description,
        videoUrl: uploadedFile.videoUrl,
        uploadedBy: uploadedFile.uploadedBy,
      })

      if (!result.success) {
        if (result.fieldErrors?.title?.[0]) {
          form.setError("title", {
            type: "server",
            message: result.fieldErrors.title[0],
          })
        }

        if (result.fieldErrors?.description?.[0]) {
          form.setError("description", {
            type: "server",
            message: result.fieldErrors.description[0],
          })
        }

        toast.error(result.error)
        return
      }

      toast.success("Video published.")
      router.push(`/v/${result.videoId}`)
      router.refresh()
    })
  }

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl tracking-tight">Upload video</CardTitle>
        <CardDescription>MP4, WebM, or MOV up to your configured max size.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={160}
                      placeholder="Give your video a title"
                      className="transition-shadow focus-visible:shadow-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      maxLength={2000}
                      rows={4}
                      placeholder="Tell viewers what this video is about"
                      className="resize-none transition-shadow focus-visible:shadow-sm"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/2000</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <UploadDropzone
                endpoint="videoUploader"
                className={cn(
                  "ut-uploading:cursor-not-allowed",
                  "ut-label:text-sm ut-label:font-medium",
                  "ut-allowed-content:text-xs ut-allowed-content:text-muted-foreground",
                  "ut-button:bg-primary ut-button:text-primary-foreground ut-button:hover:bg-primary/90",
                  "ut-button:transition-all ut-button:duration-200",
                  "ut-button:hover:-translate-y-0.5",
                  "ut-ready:border-dashed ut-ready:border-primary/35 ut-ready:bg-muted/20",
                  "ut-uploading:border-primary/45 ut-uploading:bg-primary/[0.06]",
                  "ut-readying:border-border ut-readying:bg-muted/30",
                  "ut-container:rounded-xl ut-container:transition-all ut-container:duration-200",
                )}
                appearance={{
                  container: "min-h-52",
                }}
                content={{
                  label: () => (
                    <div className="flex items-center gap-2 text-sm">
                      <UploadCloud className="size-4" />
                      Drag and drop your video, or click to browse
                    </div>
                  ),
                  button: () => "Choose file",
                }}
                onUploadBegin={() => {
                  setUploadState("uploading")
                  setUploadProgress(0)
                  setUploadedFile(null)
                }}
                onUploadProgress={(progress) => {
                  setUploadState("uploading")
                  setUploadProgress(progress)
                }}
                onClientUploadComplete={(files) => {
                  const firstFile = files[0]

                  if (!firstFile?.serverData?.videoUrl || !firstFile.serverData.uploadedBy) {
                    setUploadState("error")
                    setUploadedFile(null)
                    toast.error("Upload completed but returned invalid file data.")
                    return
                  }

                  setUploadState("uploaded")
                  setUploadProgress(100)
                  setUploadedFile({
                    videoUrl: firstFile.serverData.videoUrl,
                    uploadedBy: firstFile.serverData.uploadedBy,
                  })
                  toast.success("Video uploaded. Publish when ready.")
                }}
                onUploadError={(error) => {
                  setUploadState("error")
                  setUploadProgress(0)
                  setUploadedFile(null)
                  toast.error(error.message || "Video upload failed.")
                }}
              />

              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors",
                  uploadState === "uploaded" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                  uploadState === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
                  uploadState === "uploading" && "border-primary/30 bg-primary/5 text-primary",
                  uploadState === "idle" && "text-muted-foreground",
                )}
              >
                {uploadState === "uploading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : uploadState === "uploaded" ? (
                  <CheckCircle2 className="size-4" />
                ) : uploadState === "error" ? (
                  <AlertCircle className="size-4" />
                ) : (
                  <UploadCloud className="size-4" />
                )}
                <p>{uploadStateLabel}</p>
              </div>

              {uploadState === "uploading" ? <Progress value={uploadProgress} className="h-2" /> : null}
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={!canSubmit}>
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Publishing...
                </span>
              ) : (
                "Publish video"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
