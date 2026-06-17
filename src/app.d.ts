import type { LudoSession } from '$lib/server/services/auth'
import type { AdminSession } from '$lib/server/services/admin-auth'

declare global {
  namespace App {
    interface Locals {
      ludoSession: LudoSession | null
      adminSession: AdminSession | null
    }
  }
}

export {}
