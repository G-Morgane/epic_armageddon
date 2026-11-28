<script setup lang="ts">
const { theme, basculer } = useTheme()

/* Le libellé suit l'état Vue, qui n'est juste qu'une fois la page montée ;
   les deux icônes sont dans le DOM et c'est la classe `dark` de <html> qui
   choisit laquelle s'affiche, pour qu'aucune ne clignote à l'hydratation. */
const libelle = computed(() => (theme.value === 'sombre' ? 'Passer en thème clair' : 'Passer en thème sombre'))
</script>

<template>
  <button type="button" :aria-label="libelle" :title="libelle" @click="basculer()">
    <svg class="hidden h-5 w-5 dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
    <svg class="h-5 w-5 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  </button>
</template>
