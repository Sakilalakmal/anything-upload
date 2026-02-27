import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function UploadPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>Protected placeholder route.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Phase 3 will add UploadThing video upload.</p>
        </CardContent>
      </Card>
    </div>
  )
}
