#!/usr/bin/env node
// Harness de capture generique pilote par docs/user-docs.config.json.
// Ne demarre PAS de serveur : cible le serveur deja lance (config.baseUrl).
//
// Usage : node capture-harness.mjs [chemin/vers/config.json]
// Prerequis : `playwright` installe (pnpm add -D playwright puis npx playwright install chromium).

import { readFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

// Resilient : marche que le projet ait `playwright` ou `@playwright/test`.
async function loadChromium() {
  for (const pkg of ['playwright', '@playwright/test']) {
    try {
      return (await import(pkg)).chromium
    } catch {
      /* essayer le suivant */
    }
  }
  throw new Error('Aucun de playwright / @playwright/test trouve. Installez-en un (devDep).')
}
const chromium = await loadChromium()

const configPath = process.argv[2] ?? 'docs/user-docs.config.json'
const config = JSON.parse(await readFile(configPath, 'utf8'))

// `DOCS_BASE_URL` permet de viser un autre port sans toucher la config
// (ex. quand Vite bascule sur 5174). Sinon, la config fait foi.
const baseUrl = process.env.DOCS_BASE_URL ?? config.baseUrl ?? 'http://localhost:5173'
const viewport = config.viewport ?? { width: 1280, height: 800 }
const outDir = config.outDir ?? 'static/aide/captures'
const globalMask = config.mask ?? []

/** Execute une liste d'etapes declaratives sur la page. */
async function runSteps(page, steps = []) {
  for (const step of steps) {
    if (step.goto) await page.goto(new URL(step.goto, baseUrl).href, { waitUntil: 'networkidle' })
    if (step.fill) await page.fill(step.fill.selector, step.fill.value)
    if (step.click) await page.click(step.click)
    if (step.waitFor) await page.waitForSelector(step.waitFor, { state: 'visible' })
    if (step.press) await page.keyboard.press(step.press)
  }
}

/** Resout les selecteurs de masquage en Locators. */
function maskLocators(page, selectors) {
  return selectors.map((s) => page.locator(s))
}

/**
 * Injecte les annotations (encadres rouges + badges, spotlight) dans la page,
 * positionnees par selecteur (donc auto-repositionnees si le layout change).
 * highlights : [{ selector, label?, padding? }]  -> cadre rouge + badge numerote
 * spotlight  : "selecteur"                        -> assombrit le reste
 */
async function annotate(page, shot) {
  const spec = { highlights: shot.highlights ?? [], spotlight: shot.spotlight ?? null }
  if (!spec.highlights.length && !spec.spotlight) return
  await page.evaluate((spec) => {
    const layer = document.createElement('div')
    layer.id = '__userdocs_anno'
    layer.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;'
    document.body.appendChild(layer)

    const rectOf = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }
    }

    // Spotlight (1 cible) : assombrit tout sauf la zone, via box-shadow geant.
    if (spec.spotlight) {
      const el = document.querySelector(spec.spotlight)
      if (el) {
        const b = rectOf(el)
        const pad = 8
        const hole = document.createElement('div')
        hole.style.cssText =
          `position:absolute;left:${b.x - pad}px;top:${b.y - pad}px;` +
          `width:${b.w + pad * 2}px;height:${b.h + pad * 2}px;border-radius:12px;` +
          'box-shadow:0 0 0 9999px rgba(15,20,30,0.55);'
        layer.appendChild(hole)
      }
    }

    // Encadres rouges + badges
    spec.highlights.forEach((h, i) => {
      const el = document.querySelector(h.selector)
      if (!el) return
      const b = rectOf(el)
      const pad = h.padding ?? 4
      const box = document.createElement('div')
      box.style.cssText =
        `position:absolute;left:${b.x - pad}px;top:${b.y - pad}px;` +
        `width:${b.w + pad * 2}px;height:${b.h + pad * 2}px;` +
        'border:3px solid #f02849;border-radius:8px;box-shadow:0 0 0 2px rgba(255,255,255,.7);'
      layer.appendChild(box)

      const badge = document.createElement('div')
      badge.textContent = h.label ?? String(i + 1)
      badge.style.cssText =
        `position:absolute;left:${b.x - pad - 13}px;top:${b.y - pad - 13}px;` +
        'min-width:26px;height:26px;padding:0 7px;box-sizing:border-box;' +
        'display:flex;align-items:center;justify-content:center;' +
        'background:#f02849;color:#fff;font:700 14px/1 system-ui,sans-serif;' +
        'border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.35);'
      layer.appendChild(badge)
    })
  }, spec)
}

/** Calcule la zone de recadrage (zoom) a partir d'un selecteur. */
async function clipFor(page, shot) {
  if (!shot.clip) return undefined
  const el = await page.$(shot.clip.selector)
  if (!el) return undefined
  await el.scrollIntoViewIfNeeded()
  const box = await el.boundingBox()
  if (!box) return undefined
  const pad = shot.clip.padding ?? 16
  return {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  }
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport })
const page = await context.newPage()

let captured = 0
let failed = 0

/** Capture un shot unique (navigation + annotations + screenshot). */
async function captureShot(section, shot) {
  const file = join(outDir, section.id, `${shot.id}.png`)
  try {
    await page.goto(new URL(shot.route, baseUrl).href, { waitUntil: 'networkidle' })
    if (shot.waitFor) await page.waitForSelector(shot.waitFor, { state: 'visible' })
    if (shot.before?.length) await runSteps(page, shot.before)

    await annotate(page, shot)
    const clip = await clipFor(page, shot)

    await mkdir(dirname(file), { recursive: true })
    await page.screenshot({
      path: file,
      clip,
      fullPage: clip ? false : (shot.fullPage ?? false),
      mask: maskLocators(page, [...globalMask, ...(shot.mask ?? [])]),
    })
    captured++
    console.log(`[ok] ${section.id}/${shot.id} -> ${file}`)
  } catch (err) {
    failed++
    console.error(`[FAIL] ${section.id}/${shot.id} : ${err.message}`)
  }
}

const sections = config.sections ?? []
const eachShot = (pred) =>
  sections.flatMap((section) =>
    (section.shots ?? []).filter(pred).map((shot) => ({ section, shot })),
  )

try {
  // 1. Shots `preAuth` : capturés AVANT le login (écrans de connexion).
  //    Leurs `before` jouent les interactions nécessaires (saisie mot de passe…).
  for (const { section, shot } of eachShot((s) => s.preAuth)) {
    await captureShot(section, shot)
  }

  // 2. Authentification (une seule fois pour toute la session)
  if (config.auth?.steps?.length) {
    console.log('[auth] connexion...')
    await runSteps(page, config.auth.steps)
  }

  // 3. Shots normaux (post-login)
  for (const { section, shot } of eachShot((s) => !s.preAuth)) {
    await captureShot(section, shot)
  }
} finally {
  await browser.close()
}

console.log(`\nTermine : ${captured} captures, ${failed} echecs.`)
process.exit(failed > 0 ? 1 : 0)
