<script lang="ts">
  import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle'

  let { size = 20, label = 'Chargement…' }: { size?: number; label?: string } = $props()
</script>

<span class="spinner" role="status">
  <LoaderCircleIcon {size} aria-hidden="true" />
  <span class="sr-only">{label}</span>
</span>

<style>
  .spinner {
    display: inline-flex;
    color: currentColor;
  }
  .spinner :global(svg) {
    animation: spin var(--dur-slow, 700ms) linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
