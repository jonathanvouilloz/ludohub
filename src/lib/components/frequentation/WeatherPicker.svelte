<script lang="ts">
  import SunIcon from '@lucide/svelte/icons/sun'
  import CloudIcon from '@lucide/svelte/icons/cloud'
  import CloudRainIcon from '@lucide/svelte/icons/cloud-rain'
  import SnowflakeIcon from '@lucide/svelte/icons/snowflake'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'

  let {
    weather = $bindable<string | null>(null),
    temperature = $bindable<number | null>(null),
  }: { weather?: string | null; temperature?: number | null } = $props()

  const options = [
    { value: 'beau', label: 'Beau', icon: SunIcon },
    { value: 'gris', label: 'Gris', icon: CloudIcon },
    { value: 'pluie', label: 'Pluie', icon: CloudRainIcon },
    { value: 'neige', label: 'Neige', icon: SnowflakeIcon },
  ] as const

  function toggle(value: string) {
    weather = weather === value ? null : value
  }
</script>

<!-- Valeur soumise dans le formulaire (vide = non renseignée). -->
<input type="hidden" name="weather" value={weather ?? ''} />

<div class="weather">
  <span class="legend">Météo</span>
  <div class="pills" role="group" aria-label="Condition météo">
    {#each options as opt (opt.value)}
      <button
        type="button"
        class="pill {opt.value}"
        class:active={weather === opt.value}
        aria-pressed={weather === opt.value}
        title={opt.label}
        onclick={() => toggle(opt.value)}
      >
        <opt.icon aria-hidden="true" />
        <span>{opt.label}</span>
      </button>
    {/each}
  </div>

  <div class="temp">
    <Label for="freq-temp">Température (°C)</Label>
    <Input id="freq-temp" name="temperature" type="number" step="1" bind:value={temperature} />
  </div>
</div>

<style>
  .weather {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .legend {
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    color: var(--text-main);
  }
  .pills {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out-strong),
      border-color var(--dur-fast) var(--ease-out-strong),
      color var(--dur-fast) var(--ease-out-strong);
  }
  .pill :global(svg) {
    width: 1rem;
    height: 1rem;
  }
  .pill:hover {
    background: var(--bg-hover);
  }
  .pill.active {
    color: var(--text-inverse);
  }
  .pill.beau.active {
    background: var(--warning);
    border-color: var(--warning);
  }
  .pill.gris.active {
    background: var(--text-muted);
    border-color: var(--text-muted);
  }
  .pill.pluie.active {
    background: var(--info);
    border-color: var(--info);
  }
  .pill.neige.active {
    background: var(--accent);
    border-color: var(--accent);
  }
  .temp {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-width: 10rem;
  }
</style>
