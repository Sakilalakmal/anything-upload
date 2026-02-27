import { SignUpForm } from "@/components/auth/sign-up-form"

type SignUpPageProps = {
  searchParams: Promise<{
    redirectTo?: string
  }>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { redirectTo } = await searchParams

  return <SignUpForm redirectTo={redirectTo} />
}
