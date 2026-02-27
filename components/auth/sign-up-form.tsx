"use client"

import Link from "next/link"
import { useActionState } from "react"

import { signUpAction } from "@/app/actions/auth"
import { FormSubmitButton } from "@/components/auth/form-submit-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type SignUpFormProps = {
  redirectTo?: string
}

type AuthFormState = {
  error?: string
  fieldErrors?: {
    email?: string[]
    password?: string[]
    name?: string[]
  }
}

export function SignUpForm({ redirectTo }: SignUpFormProps) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signUpAction, {})

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Set up your account with email and password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo ?? "/profile"} />
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" name="name" type="text" autoComplete="name" placeholder="Optional" />
            {state.fieldErrors?.name?.[0] ? (
              <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            {state.fieldErrors?.email?.[0] ? (
              <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required />
            {state.fieldErrors?.password?.[0] ? (
              <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
            ) : null}
          </div>
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <FormSubmitButton className="w-full" label="Create account" pendingLabel="Creating account..." />
        </form>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link className="text-foreground underline" href="/sign-in">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
