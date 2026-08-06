/**
 * Remplacement local de la télémétrie Better Auth.
 *
 * La télémétrie est désactivée dans la configuration. Ce module évite aussi
 * d'embarquer son détecteur de paquets dans la fonction Vercel : ce détecteur
 * lit des package.json dynamiquement, ce que le traceur de fichiers interprète
 * comme une recherche récursive dans node_modules.
 */

export interface TelemetryEvent {
  type: string
  anonymousId?: string
  payload: Record<string, unknown>
}

export interface DisabledTelemetry {
  publish: (event: TelemetryEvent) => Promise<void>
}

const publish = async (event: TelemetryEvent): Promise<void> => {
  void event
}

export const createTelemetry = async (
  options: unknown,
  context?: unknown,
): Promise<DisabledTelemetry> => {
  void options
  void context
  return { publish }
}

export const getTelemetryAuthConfig = async (
  options: unknown,
  context?: unknown,
): Promise<Record<string, never>> => {
  void options
  void context
  return {}
}
