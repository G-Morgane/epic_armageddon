<script setup lang="ts">
/** Vidéo tuto en fenêtre : se ferme avec ✕, Échap ou un clic sur le fond. */
const ouvert = defineModel<boolean>({ default: false })
defineProps<{ src: string; titre: string }>()

function surTouche(e: KeyboardEvent) { if (e.key === 'Escape') ouvert.value = false }
watch(ouvert, (v) => {
  if (v) window.addEventListener('keydown', surTouche)
  else window.removeEventListener('keydown', surTouche)
})
onBeforeUnmount(() => window.removeEventListener('keydown', surTouche))
</script>

<template>
  <Teleport to="body">
    <div v-if="ouvert" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" @click.self="ouvert = false">
      <div class="w-full max-w-5xl overflow-hidden rounded-xl border border-gold/20 bg-surface shadow-2xl" role="dialog" :aria-label="titre">
        <div class="flex items-center justify-between gap-4 border-b border-gold/10 px-5 py-3">
          <h2 class="font-heading text-lg font-semibold text-gold">{{ titre }}</h2>
          <button type="button" class="rounded p-1 text-stone-400 hover:text-gold" title="Fermer (Échap)" @click="ouvert = false">✕</button>
        </div>
        <video :src="src" controls autoplay playsinline class="block aspect-[16/10] w-full bg-black" />
      </div>
    </div>
  </Teleport>
</template>
