<script setup lang="ts">
const props = withDefaults(defineProps<{
  palette?: 'fire' | 'chaos' | 'xenos'
}>(), {
  palette: 'fire',
})

const palettes: Record<string, string[]> = {
  fire: [
    '#e8952f', '#e8952f', '#c8a052',
    '#d4622a', '#c43a1a', '#b52e1c',
  ],
  chaos: [
    '#e8952f', '#e8952f', '#c8a052',
    '#d4622a', '#c43a1a', '#b52e1c',
  ],
  xenos: [
    '#2dd4a0', '#34d399', '#6ee7b7',
    '#0d9488', '#14b8a6', '#5eead4',
  ],
}

const colors = palettes[props.palette] ?? palettes.fire

const particles = Array.from({ length: 80 }, (_, i) => {
  const color = colors[Math.floor(Math.random() * colors.length)]
  return {
    id: i,
    left: `${Math.random() * 100}%`,
    size: `${2 + Math.random() * 4}px`,
    delay: `${Math.random() * 8}s`,
    duration: `${2.5 + Math.random() * 5}s`,
    drift: `${-60 + Math.random() * 120}px`,
    opacity: 0.3 + Math.random() * 0.7,
    sway: `${0.4 + Math.random() * 1.5}s`,
    swayAmount: `${15 + Math.random() * 40}px`,
    startY: `${Math.random() * 30}%`,
    color,
  }
})
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      v-for="p in particles"
      :key="p.id"
      class="ember absolute rounded-full"
      :style="{
        left: p.left,
        bottom: p.startY,
        width: p.size,
        height: p.size,
        animationDelay: p.delay,
        animationDuration: p.duration,
        '--drift': p.drift,
        '--ember-opacity': p.opacity,
        '--sway-duration': p.sway,
        '--sway-amount': p.swayAmount,
        '--ember-color': p.color,
      }"
    />
  </div>
</template>

<style scoped>
.ember {
  background: radial-gradient(circle, var(--ember-color, #e8952f), transparent);
  box-shadow: 0 0 6px 2px color-mix(in srgb, var(--ember-color, #e8952f) 40%, transparent);
  animation:
    rise linear infinite,
    sway ease-in-out infinite alternate;
  opacity: 0;
}

@keyframes rise {
  0% {
    opacity: 0;
    transform: translateY(0) translateX(0) scale(1);
  }
  8% {
    opacity: var(--ember-opacity, 0.6);
  }
  60% {
    opacity: calc(var(--ember-opacity, 0.6) * 0.6);
  }
  100% {
    opacity: 0;
    transform: translateY(-200vh) translateX(var(--drift, 20px)) scale(0.1);
  }
}

@keyframes sway {
  0% {
    margin-left: calc(var(--sway-amount, 10px) * -1);
  }
  100% {
    margin-left: var(--sway-amount, 10px);
  }
}
</style>
