<script setup lang="ts">
/**
 * Règles de l'armée, en tiroir, depuis le builder.
 *
 * Ces textes n'existaient que dans le document imprimable : pour savoir ce que
 * fait un Commissaire ou combien coûte une place d'appui, il fallait ouvrir le
 * PDF et perdre sa liste des yeux. Le tiroir sert le même contenu, à côté de la
 * construction.
 */
import type { Codex } from '~~/shared/codex/schema'
import { paragraphesEnrichis } from '~~/shared/codex/markdown'

const props = defineProps<{ meta: Codex['codex'] }>()

const ouvert = defineModel<boolean>({ default: false })

const paragraphes = (md?: string) => paragraphesEnrichis(md)
const exceptions = computed(() => props.meta.initiative?.exceptions ?? [])

function fermer() { ouvert.value = false }
function surTouche(e: KeyboardEvent) { if (e.key === 'Escape') fermer() }
watch(ouvert, (v) => {
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
      <aside v-if="ouvert" class="fixed inset-y-0 right-0 z-[61] flex w-full max-w-2xl flex-col border-l border-gold/20 bg-surface shadow-2xl" role="dialog" :aria-label="`Règles de ${meta.nom}`">
        <header class="flex items-center justify-between gap-3 border-b border-gold/10 bg-surface-light px-5 py-3">
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-widest text-gold">{{ meta.nom }}</p>
            <h2 class="truncate font-heading text-lg font-bold text-white">Règles de l'armée</h2>
          </div>
          <button type="button" class="rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white" title="Fermer (Échap)" @click="fermer">✕</button>
        </header>

        <div class="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <!-- Les deux valeurs qu'on cherche en jouant, avant les textes -->
          <div class="flex flex-wrap gap-3">
            <div class="rounded-lg border border-white/10 bg-surface-light px-4 py-2">
              <p class="text-[11px] uppercase tracking-wider text-stone-400">Valeur stratégique</p>
              <p class="font-heading text-lg text-white">{{ meta.valeur_strategique }}</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-surface-light px-4 py-2">
              <p class="text-[11px] uppercase tracking-wider text-stone-400">Initiative</p>
              <p class="font-heading text-lg text-white">{{ meta.initiative?.defaut }}</p>
              <p v-for="(e, i) in exceptions" :key="i" class="text-xs text-stone-400">{{ e.portee }} : {{ e.valeur }}</p>
            </div>
          </div>

          <section v-if="meta.intro_md">
            <h3 class="font-heading text-sm uppercase tracking-widest text-gold">Utiliser la liste d'armée</h3>
            <div class="mt-2 space-y-2 text-sm leading-relaxed text-stone-300">
              <p v-for="(p, i) in paragraphes(meta.intro_md)" :key="i" v-html="p" />
            </div>
          </section>

          <section v-for="r in meta.regles_md" :key="r.titre">
            <h3 class="font-heading text-sm uppercase tracking-widest text-gold">{{ r.titre }}</h3>
            <div class="mt-2 space-y-2 text-sm leading-relaxed text-stone-300">
              <p v-for="(p, i) in paragraphes(r.texte)" :key="i" v-html="p" />
            </div>
          </section>

          <p v-if="!meta.intro_md && !meta.regles_md?.length" class="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-stone-400">
            Ce codex ne porte aucune règle d'armée pour l'instant.
          </p>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
