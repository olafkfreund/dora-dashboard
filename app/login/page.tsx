import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { LoginForm } from "./login-form"

export const metadata = { title: "Sign in · DORA Dashboard" }

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect("/")
  return <LoginForm />
}
