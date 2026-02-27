"use client"

import { useActionState } from "react"

import { updateProfileAction } from "@/app/actions/profile"
import { FormSubmitButton } from "@/components/auth/form-submit-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ProfileNameFormProps = {
  name: string | null
  username: string | null
  bio: string | null
}

type ProfileFormState = {
  error?: string
  success?: string
  fieldErrors?: {
    name?: string[]
    username?: string[]
    bio?: string[]
  }
}

export function ProfileNameForm({ name, username, bio }: ProfileNameFormProps) {
  const [state, formAction] = useActionState<ProfileFormState, FormData>(updateProfileAction, {})

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" name="name" defaultValue={name ?? ""} placeholder="Add a display name" />
        {state.fieldErrors?.name?.[0] ? <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          defaultValue={username ?? ""}
          placeholder="your_handle"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <p className="text-xs text-muted-foreground">Use lowercase letters, numbers, and underscores.</p>
        {state.fieldErrors?.username?.[0] ? (
          <p className="text-sm text-destructive">{state.fieldErrors.username[0]}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" defaultValue={bio ?? ""} placeholder="Tell people what you create." maxLength={280} />
        {state.fieldErrors?.bio?.[0] ? <p className="text-sm text-destructive">{state.fieldErrors.bio[0]}</p> : null}
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success ? (
        <Alert>
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      ) : null}
      <FormSubmitButton className="transition-transform hover:-translate-y-0.5" label="Save changes" pendingLabel="Saving..." />
    </form>
  )
}
