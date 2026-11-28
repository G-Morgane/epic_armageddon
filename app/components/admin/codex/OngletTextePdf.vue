<script setup lang="ts">
/**
 * Tout ce qui s'imprime en toutes lettres sur la fiche téléchargeable : citation,
 * crédits, introduction et règles spéciales. Séparé de l'onglet Armée, où ces
 * quatre blocs de texte long noyaient l'identité et les règles du codex.
 */
import { enrichir } from '~~/shared/codex/markdown'

const codex = useBrouillonCodex()
const meta = computed(() => codex.value.codex)

/**
 * Un textarea qui suit son contenu. Ces textes font souvent dix lignes : à hauteur
 * fixe on les relisait par une fenêtre de trois.
 */
const vHauteurAuto = {
  mounted(el: HTMLTextAreaElement) {
    const ajuster = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight + 2}px`
    }
    el.addEventListener('input', ajuster)
    nextTick(ajuster)
  },
  updated(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  },
}

function ajouterRegle() {
  ;(meta.value.regles_md ??= []).push({ titre: 'Règle spéciale : ', texte: '' })
}
function retirerRegle(i: number) {
  meta.value.regles_md!.splice(i, 1)
}
</script>

<template>
  <div class="space-y-8">
    <section>
      <h3 class="titre-bloc">Citation et crédits</h3>
      <p class="sous-titre-bloc">En exergue sur la page de présentation, et en bas de la dernière page.</p>
      <div class="carte mt-3 grid gap-4 lg:grid-cols-2">
        <label class="champ-label lg:col-span-2">Citation
          <textarea v-hauteur-auto :value="meta.citation?.texte" rows="2" class="champ min-h-[4.5rem] resize-none font-body text-base" @input="meta.citation = { ...(meta.citation ?? {}), texte: ($event.target as HTMLTextAreaElement).value }" />
        </label>
        <label class="champ-label">Auteur de la citation<input :value="meta.citation?.auteur" class="champ" placeholder="Chanoinesse Ismelda Caritados" @input="meta.citation = { texte: meta.citation?.texte ?? '', auteur: ($event.target as HTMLInputElement).value }"></label>
        <label class="champ-label">Crédits (bas de page)
          <textarea v-model="meta.credits" v-hauteur-auto rows="2" class="champ min-h-[4.5rem] resize-none" />
        </label>
      </div>
    </section>

    <section>
      <h3 class="titre-bloc">Utiliser la liste d'armée</h3>
      <p class="sous-titre-bloc">Texte d'introduction, paragraphes séparés par une ligne vide. Mise en forme : <code>**gras**</code> et <code>*italique*</code>.</p>
      <div class="carte mt-3">
        <textarea v-model="meta.intro_md" v-hauteur-auto rows="6" class="champ min-h-[10rem] resize-none font-body text-base" />
      </div>
    </section>

    <section>
      <h3 class="titre-bloc">Règles spéciales <span class="text-sm font-normal text-gray-500">({{ meta.regles_md?.length ?? 0 }})</span></h3>
      <p class="sous-titre-bloc">Texte libre, imprimé après l'introduction.</p>
      <div class="carte mt-3">
        <div v-for="(r, i) in meta.regles_md" :key="i" class="mb-3 rounded-md border border-white/10 p-3">
          <div class="flex gap-2">
            <input v-model="r.titre" class="champ flex-1 font-semibold" placeholder="Règle spéciale : …">
            <button type="button" class="shrink-0 text-gray-500 hover:text-red-300" @click="retirerRegle(i)">✕</button>
          </div>
          <textarea v-model="r.texte" v-hauteur-auto rows="3" class="champ mt-2 min-h-[6rem] resize-none font-body text-base" />
          <!-- eslint-disable-next-line vue/no-v-html -- texte échappé par enrichir() -->
          <p v-if="/[*_]/.test(r.texte)" class="mt-1 rounded bg-black/20 px-2 py-1 font-body text-[13px] text-gray-300"><span class="mr-1 text-[10px] uppercase tracking-wider text-gray-500">Aperçu</span><span v-html="enrichir(r.texte)" /></p>
        </div>
        <p v-if="!meta.regles_md?.length" class="mb-2 text-sm text-gray-600">Aucune règle spéciale.</p>
        <button type="button" class="lien" @click="ajouterRegle">+ Ajouter une règle spéciale</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.titre-bloc { @apply font-heading text-lg font-semibold text-gold; }
.sous-titre-bloc { @apply text-xs text-gray-500; }
.carte { @apply rounded-lg border border-gold/10 bg-surface-light p-5; }
.champ-label { @apply flex flex-col gap-1 text-xs text-gray-400; }
.champ { @apply w-full rounded-md border border-white/10 bg-surface px-3 py-1.5 text-sm text-gray-100 focus:border-gold focus:outline-none; }
.lien { @apply text-sm text-gold hover:underline; }
</style>
