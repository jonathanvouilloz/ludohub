import imageCompression from 'browser-image-compression'

export type EditorialImageProfile = 'content' | 'gallery'

const PROFILES = {
  content: { maxWidthOrHeight: 1600, maxSizeMB: 1.5 },
  gallery: { maxWidthOrHeight: 2000, maxSizeMB: 2 },
} as const

function webpName(name: string) {
  const base = name.replace(/\.[^.]+$/, '').trim() || 'image'
  return `${base}.webp`
}

/**
 * Redimensionne, réoriente et compresse une image avant l'envoi à LudoHub.
 * Le serveur conserve ses propres validations : cette étape optimise le transfert,
 * elle ne constitue pas une frontière de sécurité.
 */
export async function compressEditorialImage(file: File, profile: EditorialImageProfile) {
  if (!file.type.startsWith('image/')) throw new Error('Sélectionnez une image valide.')
  const options = PROFILES[profile]
  const compressed = await imageCompression(file, {
    ...options,
    useWebWorker: true,
    fileType: 'image/webp',
    preserveExif: false,
  })
  return new File([compressed], webpName(file.name), {
    type: 'image/webp',
    lastModified: Date.now(),
  })
}

export async function compressEditorialImageFormData(
  formData: FormData,
  profile: EditorialImageProfile,
) {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) throw new Error('Sélectionnez une image.')
  formData.set('file', await compressEditorialImage(file, profile))
}

/**
 * Compresse plusieurs champs image d'un même formulaire (un par position d'un Top 3),
 * en ignorant les champs laissés vides.
 */
export async function compressEditorialImageFields(
  formData: FormData,
  names: readonly string[],
  profile: EditorialImageProfile,
) {
  for (const name of names) {
    const file = formData.get(name)
    if (!(file instanceof File) || file.size === 0) {
      formData.delete(name)
      continue
    }
    formData.set(name, await compressEditorialImage(file, profile))
  }
}
