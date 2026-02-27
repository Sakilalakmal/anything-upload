import { SignInForm } from "@/components/auth/sign-in-form"

type SignInPageProps = {
  searchParams: Promise<{
    redirectTo?: string
  }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { redirectTo } = await searchParams

  return <SignInForm redirectTo={redirectTo} />
}
