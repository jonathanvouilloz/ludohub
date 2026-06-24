<script lang="ts">
  import type { GuideSection } from '$lib/aide/types'
  import Rich from '$lib/aide/Rich.svelte'
  import ZoomInIcon from '@lucide/svelte/icons/zoom-in'
  import LightbulbIcon from '@lucide/svelte/icons/lightbulb'

  let {
    section,
    captureBase = '/aide/captures',
    version = '',
    onZoom,
  }: {
    section: GuideSection
    captureBase?: string
    version?: string
    onZoom?: (src: string, alt: string) => void
  } = $props()

  const v = $derived(version ? `?v=${version}` : '')
  const srcOf = (shot: string) => `${captureBase}/${section.id}/${shot}.png${v}`
</script>

<section id={section.id} class="guide-section">
  <header class="sec-head">
    <h2>{section.title}</h2>
    {#if section.intro}
      <p class="intro"><Rich text={section.intro} /></p>
    {/if}
  </header>

  {#each section.steps as step, i (step.title)}
    <article class="step" id="{section.id}-{i}">
      <h3><span class="step-num">{i + 1}</span>{step.title}</h3>

      <div class="step-body">
        <div class="prose">
          <ol class="actions">
            {#each step.body as line (line)}
              <li><Rich text={line} /></li>
            {/each}
          </ol>

          {#if step.tips?.length}
            <ul class="tips">
              {#each step.tips as tip (tip)}
                <li><Rich text={tip} /></li>
              {/each}
            </ul>
          {/if}

          {#if step.note}
            <aside class="note">
              <span class="note-icon" aria-hidden="true"><LightbulbIcon size={16} /></span>
              <span><strong>Bon à savoir :</strong> <Rich text={step.note} /></span>
            </aside>
          {/if}
        </div>

        {#if step.shot}
          {@const shotSrc = srcOf(step.shot)}
          <button
            type="button"
            class="shot"
            onclick={() => onZoom?.(shotSrc, step.title)}
            aria-label="Agrandir l’image : {step.title}"
          >
            <img src={shotSrc} alt={step.title} loading="lazy" />
            <span class="shot-zoom" aria-hidden="true"><ZoomInIcon size={16} /></span>
          </button>
        {/if}
      </div>
    </article>
  {/each}
</section>

<style>
  .guide-section {
    margin-block-end: var(--space-12);
    scroll-margin-top: var(--space-8);
  }
  .sec-head {
    padding-block-end: var(--space-3);
    margin-block-end: var(--space-6);
    border-bottom: 1px solid var(--border);
  }
  .guide-section h2 {
    font-size: var(--text-display);
    font-weight: var(--weight-bold);
    color: var(--text-main);
    margin: 0;
    letter-spacing: -0.01em;
  }
  .intro {
    color: var(--text-muted);
    max-inline-size: 62ch;
    margin: var(--space-2) 0 0;
    line-height: var(--leading-base);
  }

  .step {
    margin-block: var(--space-8);
    scroll-margin-top: var(--space-8);
  }
  .step h3 {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-h1);
    font-weight: var(--weight-bold);
    color: var(--text-main);
    margin: 0 0 var(--space-4);
  }
  .step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border-radius: var(--radius-pill);
    background: var(--ludo-color);
    color: var(--text-inverse);
    font-size: var(--text-body);
    font-weight: var(--weight-bold);
  }

  /* Texte à gauche, image à droite sur large écran : l'image ne mange plus
     tout l'espace et le texte reste lisible à côté. */
  .step-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-6);
    align-items: start;
  }
  @media (max-width: 900px) {
    .step-body {
      grid-template-columns: 1fr;
    }
  }

  .prose {
    color: var(--text-main);
    line-height: var(--leading-base);
  }
  /* Le Preflight Tailwind force list-style:none sur tout ol/ul → on rétablit un
     marqueur explicite sous forme de puce colorée (même langage que .tips). */
  .actions {
    margin: 0;
    padding-inline-start: var(--space-5);
    list-style: none;
  }
  .actions li {
    position: relative;
    margin-block: var(--space-2);
  }
  .actions li::before {
    content: '';
    position: absolute;
    inset-inline-start: calc(-1 * var(--space-4));
    inset-block-start: 0.55em;
    inline-size: 6px;
    block-size: 6px;
    border-radius: var(--radius-pill);
    background: var(--ludo-color);
  }
  .actions :global(strong) {
    color: var(--text-main);
    font-weight: var(--weight-bold);
  }

  .tips {
    margin: var(--space-4) 0 0;
    padding: var(--space-3) var(--space-4) var(--space-3) var(--space-6);
    list-style: none;
    background: var(--bg-hover);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .tips li {
    position: relative;
    margin-block: var(--space-1);
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .tips li::before {
    content: '';
    position: absolute;
    inset-inline-start: calc(-1 * var(--space-4));
    inset-block-start: 0.55em;
    inline-size: 6px;
    block-size: 6px;
    border-radius: var(--radius-pill);
    background: var(--ludo-color);
  }

  .note {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin-block-start: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--primary-light);
    color: var(--text-main);
    font-size: var(--text-small);
    line-height: var(--leading-base);
  }
  .note-icon {
    display: inline-flex;
    flex: 0 0 auto;
    margin-block-start: 1px;
    color: var(--ludo-color);
  }

  /* Image : carte cliquable, zoom léger au survol (la loupe = ouverture plein écran). */
  .shot {
    display: block;
    position: relative;
    inline-size: 100%;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
    cursor: zoom-in;
    transition:
      transform var(--dur-base) var(--ease-out-strong),
      box-shadow var(--dur-base) var(--ease-out-strong);
  }
  .shot img {
    display: block;
    inline-size: 100%;
    block-size: auto;
  }
  .shot:hover,
  .shot:focus-visible {
    transform: translateY(-2px) scale(1.01);
    box-shadow: var(--shadow-md);
    outline: none;
  }
  .shot-zoom {
    position: absolute;
    inset-block-start: var(--space-2);
    inset-inline-end: var(--space-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--text-main) 78%, transparent);
    color: var(--text-inverse);
    opacity: 0;
    transition: opacity var(--dur-fast) var(--ease-out-strong);
  }
  .shot:hover .shot-zoom,
  .shot:focus-visible .shot-zoom {
    opacity: 1;
  }
</style>
