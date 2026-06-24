<script lang="ts">
  import type { GuideSection } from '$lib/aide/types'

  let {
    section,
    captureBase = '/aide/captures',
    version = '',
  }: { section: GuideSection; captureBase?: string; version?: string } = $props()

  const v = $derived(version ? `?v=${version}` : '')
</script>

<section id={section.id} class="guide-section">
  <h2>{section.title}</h2>
  {#if section.intro}
    <p class="intro">{section.intro}</p>
  {/if}

  {#each section.steps as step (step.title)}
    <article class="step">
      <h3>{step.title}</h3>
      {#if step.shot}
        <img
          src="{captureBase}/{section.id}/{step.shot}.png{v}"
          alt={step.title}
          loading="lazy"
          class="shot"
        />
      {/if}
      <ol>
        {#each step.body as line (line)}
          <li>{line}</li>
        {/each}
      </ol>
      {#if step.note}
        <aside class="note"><strong>Bon à savoir :</strong> {step.note}</aside>
      {/if}
    </article>
  {/each}
</section>

<style>
  .guide-section {
    margin-block-end: var(--space-12);
  }
  .guide-section h2 {
    font-size: var(--text-h1);
    font-weight: var(--weight-bold);
    color: var(--text-main);
    margin: 0 0 var(--space-2);
  }
  .intro {
    color: var(--text-muted);
    max-inline-size: 60ch;
    margin: 0 0 var(--space-6);
  }
  .step {
    margin-block: var(--space-6);
  }
  .step h3 {
    font-size: var(--text-h2);
    font-weight: var(--weight-semibold);
    color: var(--text-main);
    margin: 0 0 var(--space-3);
  }
  .shot {
    display: block;
    inline-size: 100%;
    max-inline-size: 760px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    margin-block-end: var(--space-3);
  }
  .step ol {
    margin: 0;
    padding-inline-start: var(--space-5);
    color: var(--text-main);
    line-height: var(--leading-base);
  }
  .step li {
    margin-block: var(--space-1);
  }
  .note {
    margin-block-start: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--primary-light);
    color: var(--text-main);
    font-size: var(--text-small);
  }
</style>
