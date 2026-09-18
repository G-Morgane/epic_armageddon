<script setup lang="ts">
/**
 * Visionneuse d'aperçu PDF en tiroir : affiche la page imprimable du codex dans un cadre,
 * avec le téléchargement du vrai PDF. `brouillon` : aperçu du brouillon d'admin.
 */
const props = defineProps<{
  slug: string
  nom?: string
  brouillon?: boolean
  /** change pour forcer le rechargement (après enregistrement d'un brouillon) */
  version?: number | string
}>()
const ouvert = defineModel<boolean>({ default: false })

const src = computed(() => `/codex-test/${props.slug}/imprimer${props.brouillon ? '?brouillon=1' : '?'}&v=${props.version ?? 0}`)
const pdf = computed(() => `/api/codex/${props.slug}/pdf${props.brouillon ? '?brouillon=1' : ''}`)
const chargement = ref(true)

function fermer() { ouvert.value = false }
function surTouche(e: KeyboardEvent) { if (e.key === 'Escape') fermer() }
watch(ouvert, (v) => {
  chargement.value = true
  if (v) window.addEventListener('keydown', surTouche)
  else window.removeEventListener('keydown', surTouche)
})
onBeforeUnmount(() => window.removeEventListener('keydown', surTouche))
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="ouvert" class="fixed inset-0 z-[60] bg-black/60" @click="fermer" />
    </Transition>
    <Transition enter-active-class="transition duration-250 ease-out" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition duration-200 ease-in" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <aside v-if="ouvert" class="fixed inset-y-0 right-0 z-[61] flex w-full max-w-5xl flex-col border-l border-gold/20 bg-surface shadow-2xl" role="dialog" :aria-label="`Aperçu PDF ${nom ?? slug}`">
        <header class="flex items-center justify-between gap-3 border-b border-gold/10 bg-surface-light px-5 py-3">
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-widest text-gold">Aperçu PDF{{ brouillon ? ' · brouillon' : '' }}</p>
            <h2 class="truncate font-heading text-lg font-bold text-white">{{ nom ?? slug }}</h2>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <a :href="pdf" target="_blank" class="rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light">Télécharger le PDF</a>
            <button type="button" class="rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white" title="Fermer (Échap)" @click="fermer">✕</button>
          </div>
        </header>
        <div class="relative flex-1 bg-[#4a4540]">
          <div v-if="chargement" class="absolute inset-0 flex items-center justify-center text-sm text-gray-300">Chargement de l'aperçu…</div>
          <iframe :src="src" class="h-full w-full" :class="chargement ? 'opacity-0' : 'opacity-100'" title="Aperçu du codex" @load="chargement = false" />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
