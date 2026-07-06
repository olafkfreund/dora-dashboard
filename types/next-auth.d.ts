import { DefaultSession } from "next-auth"

type AppRole = "ADMIN" | "LEAD" | "VIEWER"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: AppRole
    } & DefaultSession["user"]
  }
  interface User {
    role?: AppRole
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string
    role?: AppRole
  }
}
