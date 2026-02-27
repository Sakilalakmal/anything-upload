"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type FormSubmitButtonProps = {
  className?: string
  label: string
  pendingLabel: string
}

export function FormSubmitButton({ className, label, pendingLabel }: FormSubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button className={className} type="submit" disabled={pending}>
      {pending ? <Spinner className="mr-2 size-4" /> : null}
      {pending ? pendingLabel : label}
    </Button>
  )
}
