"use client"

import Link from "next/link"
import { useActionState } from "react"

import { signInAction } from "@/app/actions/auth"
import { FormSubmitButton } from "@/components/auth/form-submit-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type SignInFormProps = {
  redirectTo?: string
}

type AuthFormState = {
  error?: string
  fieldErrors?: {
    email?: string[]
    password?: string[]
  }
}

export function SignInForm({ redirectTo }: SignInFormProps) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signInAction, {})

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your email and password to access your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo ?? "/profile"} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            {state.fieldErrors?.email?.[0] ? (
              <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
            {state.fieldErrors?.password?.[0] ? (
              <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
            ) : null}
          </div>
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <FormSubmitButton className="w-full" label="Sign in" pendingLabel="Signing in..." />
        </form>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Don&apos;t have an account?&nbsp;
        <Link className="text-foreground underline" href="/sign-up">
          Sign up
        </Link>
      </CardFooter>
    </Card>
  )
}
