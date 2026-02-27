"use client"

import { useActionState } from "react"

import { updateProfileNameAction } from "@/app/actions/profile"
import { FormSubmitButton } from "@/components/auth/form-submit-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ProfileNameFormProps = {
  name: string | null
}

type ProfileFormState = {
  error?: string
  success?: string
  fieldErrors?: {
    name?: string[]
  }
}

export function ProfileNameForm({ name }: ProfileNameFormProps) {
  const [state, formAction] = useActionState<ProfileFormState, FormData>(updateProfileNameAction, {})

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" name="name" defaultValue={name ?? ""} placeholder="Add a display name" />
        {state.fieldErrors?.name?.[0] ? <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p> : null}
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
      <FormSubmitButton label="Save changes" pendingLabel="Saving..." />
    </form>
  )
}
