import type { LudoSession } from '$lib/server/services/auth'
import type { AdminSession } from '$lib/server/services/admin-auth'
import type { LudothequeRow, MemberRow } from '$lib/server/schema'

declare global {
  namespace App {
    interface Locals {
      ludoSession: LudoSession | null
      adminSession: AdminSession | null
      ludo?: LudothequeRow
      currentMember?: MemberRow
    }
  }
}

export {}
