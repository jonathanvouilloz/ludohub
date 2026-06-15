import type { LudoSession } from '$lib/server/services/auth'
import type { LudothequeRow, MemberRow } from '$lib/server/schema'

declare global {
  namespace App {
    interface Locals {
      ludoSession: LudoSession | null
      ludo?: LudothequeRow
      currentMember?: MemberRow
    }
  }
}

export {}
