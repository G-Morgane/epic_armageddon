<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Tutos' })

/** Vidéos enregistrées sur l'admin elle-même, dans `public/tutos/admin`. */
const tutos = [
  { fichier: 'creer-une-armee', titre: 'Créer une armée', texte: 'Nouvelle armée, choix du genre, nom et faction, puis les onglets de l\'éditeur.' },
  { fichier: 'ajouter-une-unite', titre: 'Ajouter une unité', texte: 'Onglet Unités : caractéristiques, armes et notes d\'une nouvelle unité.' },
  { fichier: 'ajouter-une-formation', titre: 'Ajouter une formation', texte: 'Onglet Liste d\'armée : nom, coût, composition, améliorations et règles.' },
  { fichier: 'publier-une-mise-a-jour', titre: 'Publier une mise à jour', texte: 'Corriger un coût, relire les changements, puis publier une nouvelle version.' },
  { fichier: 'annoncer-un-evenement', titre: 'Annoncer un événement', texte: 'Ajouter un tournoi : dates, lieu, contact et lien d\'inscription.' },
  { fichier: 'traiter-un-signalement', titre: 'Traiter un signalement', texte: 'Lire un bug envoyé par un joueur, le suivre et le classer.' },
]

const enCours = ref<(typeof tutos)[number] | null>(null)
const ouvert = computed({
  get: () => !!enCours.value,
  set: (v) => { if (!v) enCours.value = null },
})
</script>

<template>
  <div>
    <h1 class="font-heading text-2xl font-bold text-gold">Tutos</h1>
    <p class="mt-1 max-w-2xl text-sm text-gray-400">
      Des vidéos courtes pour les tâches courantes, et le guide complet de l'administration en PDF.
    </p>

    <a
      href="/tutos/admin/guide-administration.pdf"
      target="_blank"
      class="mt-6 flex max-w-2xl items-center gap-4 rounded-lg border border-gold/20 bg-surface-light p-4 transition-colors hover:border-gold/40"
    >
      <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gold/10 font-heading text-sm font-bold text-gold">PDF</span>
      <span class="min-w-0">
        <span class="block font-semibold text-gray-100">Guide d'administration</span>
        <span class="block text-sm text-gray-400">Tout le fonctionnement du site et de l'admin, pas à pas (30 pages).</span>
      </span>
      <span class="ml-auto shrink-0 text-sm text-gold">Ouvrir</span>
    </a>

    <h2 class="mt-8 font-heading text-lg font-semibold text-gold">Vidéos</h2>
    <div class="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <button
        v-for="t in tutos"
        :key="t.fichier"
        type="button"
        class="group overflow-hidden rounded-lg border border-gold/10 bg-surface-light text-left transition-colors hover:border-gold/40"
        @click="enCours = t"
      >
        <span class="relative block aspect-[16/10] bg-black">
          <img :src="`/tutos/admin/${t.fichier}.jpg`" alt="" loading="lazy" class="h-full w-full object-cover object-top opacity-70 transition-opacity group-hover:opacity-90">
          <span class="absolute inset-0 flex items-center justify-center">
            <span class="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-lg text-surface shadow-lg">▶</span>
          </span>
        </span>
        <span class="block p-4">
          <span class="block font-semibold text-gray-100">{{ t.titre }}</span>
          <span class="mt-1 block text-sm text-gray-400">{{ t.texte }}</span>
        </span>
      </button>
    </div>

    <p class="mt-6 text-xs text-gray-500">Les vidéos ont été tournées sur des exemples : rien n'y a été réellement enregistré ni publié.</p>

    <TutoVideo v-if="enCours" v-model="ouvert" :src="`/tutos/admin/${enCours.fichier}.webm`" :titre="enCours.titre" />
  </div>
</template>
