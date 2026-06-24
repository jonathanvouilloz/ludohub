<script lang="ts">
  import GuideSection from '$lib/aide/GuideSection.svelte'
  import { sections, docsVersion } from '$lib/aide/content'
  import type { GuideSection as Section } from '$lib/aide/types'
  import SearchIcon from '@lucide/svelte/icons/search'
  import XIcon from '@lucide/svelte/icons/x'
  import RocketIcon from '@lucide/svelte/icons/rocket'
  import BookOpenIcon from '@lucide/svelte/icons/book-open'

  let query = $state('')
  let activeId = $state(sections[0]?.id ?? '')
  let zoom = $state<{ src: string; alt: string } | null>(null)

  const quickStart = sections[0]

  // Recherche : filtre les chapitres et leurs étapes. Une section entière est
  // gardée si son titre/intro matche ; sinon on ne garde que les étapes qui matchent.
  const q = $derived(query.trim().toLowerCase())
  const has = (s: string | undefined) => !!s && s.toLowerCase().includes(q)
  const filtered = $derived.by<Section[]>(() => {
    if (!q) return sections
    const out: Section[] = []
    for (const sec of sections) {
      if (has(sec.title) || has(sec.intro)) {
        out.push(sec)
        continue
      }
      const steps = sec.steps.filter(
        (st) => has(st.title) || st.body.some(has) || st.tips?.some(has) || has(st.note),
      )
      if (steps.length) out.push({ ...sec, steps })
    }
    return out
  })
  const resultCount = $derived(filtered.reduce((n, s) => n + s.steps.length, 0))

  // Scroll-spy : surligne dans le sommaire le chapitre visible à l'écran.
  $effect(() => {
    // Dépend de `filtered` pour ré-observer quand le contenu change.
    void filtered
    if (typeof IntersectionObserver === 'undefined') return
    const els = Array.from(document.querySelectorAll<HTMLElement>('.guide-section'))
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (vis) activeId = vis.target.id
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  })

  // Fermeture de la visionneuse au clavier.
  $effect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') zoom = null
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
</script>

<svelte:head>
  <title>Aide</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="doc">
  <aside class="doc-nav">
    <div class="search">
      <SearchIcon size={16} class="search-icon" aria-hidden="true" />
      <input
        type="search"
        bind:value={query}
        placeholder="Rechercher dans l’aide…"
        aria-label="Rechercher dans l’aide"
      />
    </div>

    {#if q}
      <p class="result-count">{resultCount} résultat{resultCount > 1 ? 's' : ''}</p>
    {/if}

    <nav aria-label="Sommaire de l’aide">
      <ol class="chapters">
        {#each filtered as section (section.id)}
          <li>
            <a href="#{section.id}" class="chapter" class:active={activeId === section.id}>
              {section.title}
            </a>
            <ul class="sub">
              {#each section.steps as step, i (step.title)}
                <li><a href="#{section.id}-{i}">{step.title}</a></li>
              {/each}
            </ul>
          </li>
        {/each}
      </ol>
      {#if q && filtered.length === 0}
        <p class="empty">Aucun résultat pour « {query} ».</p>
      {/if}
    </nav>
  </aside>

  <main class="doc-content">
    <header class="doc-head">
      <p class="eyebrow"><BookOpenIcon size={16} aria-hidden="true" /> Centre d’aide</p>
      <h1>Aide & guide d’utilisation</h1>
      <p class="lead">
        Retrouvez ici, en images, comment utiliser chaque partie de LudoHub. Cherchez un mot-clé ou
        parcourez les chapitres.
      </p>

      {#if quickStart && !q}
        <a class="quickstart" href="#{quickStart.id}">
          <span class="qs-icon" aria-hidden="true"><RocketIcon size={20} /></span>
          <span class="qs-text">
            <strong>Guide de démarrage rapide</strong>
            <span>Première connexion ? Commencez par « {quickStart.title} ».</span>
          </span>
        </a>
      {/if}
    </header>

    {#each filtered as section (section.id)}
      <GuideSection {section} version={docsVersion} onZoom={(src, alt) => (zoom = { src, alt })} />
    {/each}

    {#if q && filtered.length === 0}
      <p class="empty-content">
        Aucune rubrique ne correspond à « {query} ». Essayez un autre mot-clé.
      </p>
    {/if}
  </main>
</div>

{#if zoom}
  <!-- Visionneuse plein écran (loupe) : clic ou Échap pour fermer. -->
  <div
    class="lightbox"
    role="button"
    tabindex="0"
    aria-label="Fermer l’aperçu"
    onclick={() => (zoom = null)}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ' ? (zoom = null) : null)}
  >
    <button type="button" class="lb-close" aria-label="Fermer"><XIcon size={20} /></button>
    <img src={zoom.src} alt={zoom.alt} />
  </div>
{/if}

<style>
  .doc {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: var(--space-8);
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  @media (max-width: 1023px) {
    .doc {
      grid-template-columns: 1fr;
      gap: var(--space-6);
    }
  }

  /* ── Sommaire latéral ───────────────────────────────────── */
  .doc-nav {
    position: sticky;
    top: var(--space-6);
    align-self: start;
    max-height: calc(100dvh - var(--space-12));
    overflow-y: auto;
  }
  @media (max-width: 1023px) {
    .doc-nav {
      position: static;
      max-height: none;
    }
  }
  .search {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search :global(.search-icon) {
    position: absolute;
    inset-inline-start: var(--space-3);
    color: var(--text-subtle);
    pointer-events: none;
  }
  .search input {
    inline-size: 100%;
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-8);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--bg-card);
    color: var(--text-main);
    font-size: var(--text-small);
    font-family: inherit;
  }
  .search input:focus-visible {
    outline: none;
    border-color: var(--ludo-color);
    box-shadow: var(--shadow-focus);
  }
  .result-count {
    margin: var(--space-3) 0 0;
    font-size: var(--text-label);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .chapters {
    list-style: none;
    margin: var(--space-4) 0 0;
    padding: 0;
  }
  .chapters > li {
    margin-block-end: var(--space-3);
  }
  .chapter {
    display: block;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--text-main);
    font-weight: var(--weight-bold);
    font-size: var(--text-body);
    text-decoration: none;
  }
  .chapter:hover {
    background: var(--bg-hover);
  }
  .chapter.active {
    color: var(--ludo-color);
    background: var(--primary-light);
  }
  .sub {
    list-style: none;
    margin: var(--space-1) 0 0;
    padding-inline-start: var(--space-3);
    border-inline-start: 1px solid var(--border);
  }
  .sub a {
    display: block;
    padding: var(--space-1) var(--space-2);
    color: var(--text-muted);
    font-size: var(--text-small);
    text-decoration: none;
    border-radius: var(--radius-sm);
  }
  .sub a:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }
  .empty {
    margin-top: var(--space-3);
    font-size: var(--text-small);
    color: var(--text-muted);
  }

  /* ── Contenu ────────────────────────────────────────────── */
  .doc-content {
    min-width: 0;
    max-inline-size: 860px;
  }
  .doc-head {
    margin-block-end: var(--space-10);
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-2);
    color: var(--ludo-color);
    font-weight: var(--weight-bold);
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .doc-head h1 {
    margin: 0;
    font-size: var(--text-display);
    font-weight: var(--weight-bold);
    color: var(--text-main);
    letter-spacing: -0.01em;
  }
  .lead {
    margin: var(--space-2) 0 0;
    max-inline-size: 60ch;
    color: var(--text-muted);
    line-height: var(--leading-base);
  }
  .quickstart {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-block-start: var(--space-6);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
    text-decoration: none;
    transition:
      transform var(--dur-fast) var(--ease-out-strong),
      box-shadow var(--dur-fast) var(--ease-out-strong);
  }
  .quickstart:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  .qs-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    inline-size: 44px;
    block-size: 44px;
    border-radius: var(--radius-md);
    background: var(--ludo-color);
    color: var(--text-inverse);
  }
  .qs-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .qs-text strong {
    color: var(--text-main);
    font-size: var(--text-card-title);
  }
  .qs-text span {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .empty-content {
    color: var(--text-muted);
  }

  /* ── Visionneuse ────────────────────────────────────────── */
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    padding: var(--space-8);
    background: rgba(15, 20, 30, 0.78);
    cursor: zoom-out;
  }
  .lightbox img {
    max-inline-size: 92vw;
    max-block-size: 88vh;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
  }
  .lb-close {
    position: absolute;
    inset-block-start: var(--space-5);
    inset-inline-end: var(--space-5);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--bg-card);
    color: var(--text-main);
    cursor: pointer;
    box-shadow: var(--shadow-md);
  }
</style>
