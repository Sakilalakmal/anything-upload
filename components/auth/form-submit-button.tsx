"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

type FormSubmitButtonProps = {
  className?: string
  label: string
  pendingLabel: string
}

export function FormSubmitButton({ className, label, pendingLabel }: FormSubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button className={className} type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  )
}
