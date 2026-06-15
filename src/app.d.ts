import type { auth } from '$lib/server/auth'

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

declare global {
  namespace App {
    interface Locals {
      session: Session
    }
  }
}

export {}
