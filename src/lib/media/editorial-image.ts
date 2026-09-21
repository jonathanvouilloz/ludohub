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

/** Compresse toutes les images choisies dans un champ `multiple`. */
export async function compressEditorialImageEntries(
  formData: FormData,
  name: string,
  profile: EditorialImageProfile,
) {
  const files = formData
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0)
  formData.delete(name)
  for (const file of files) formData.append(name, await compressEditorialImage(file, profile))
}

/**
 * Réenregistre un PDF avec des flux d'objets compressés. Le fichier original est
 * conservé si cette optimisation ne le rend pas plus léger.
 */
export async function compressEditorialPdf(file: File) {
  if (file.type !== 'application/pdf') throw new Error('Sélectionnez un PDF valide.')
  const { PDFDocument } = await import('pdf-lib')
  const document = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const optimized = await document.save({ useObjectStreams: true, addDefaultPage: false })
  if (optimized.byteLength >= file.size) return file
  const bytes = new Uint8Array(optimized)
  return new File([bytes.buffer], file.name, {
    type: 'application/pdf',
    lastModified: Date.now(),
  })
}

export async function compressEditorialPdfFields(formData: FormData, names: readonly string[]) {
  for (const name of names) {
    const file = formData.get(name)
    if (!(file instanceof File) || file.size === 0) {
      formData.delete(name)
      continue
    }
    formData.set(name, await compressEditorialPdf(file))
  }
}
