<script lang="ts">
  let {
    width = '100%',
    height = '1rem',
    radius = 'var(--radius-sm)',
    class: className = '',
  }: {
    width?: string
    height?: string
    radius?: string
    class?: string
  } = $props()
</script>

<span
  class="skeleton {className}"
  style="width: {width}; height: {height}; border-radius: {radius};"
  aria-hidden="true"
></span>

<style>
  .skeleton {
    display: block;
    background: linear-gradient(90deg, var(--bg-base) 25%, var(--border) 37%, var(--bg-base) 63%);
    background-size: 400% 100%;
    animation: shimmer var(--dur-reveal, 600ms) ease-in-out infinite;
  }
  @keyframes shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: 0 0;
    }
  }
  /* prefers-reduced-motion → --dur-reveal vaut 0ms : on fige le fond. */
  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
      background: var(--border);
    }
  }
</style>
