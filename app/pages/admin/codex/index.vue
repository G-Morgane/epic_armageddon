<script setup lang="ts">
/**
 * L'ancien écran des codex a fusionné avec la liste des armées : une armée y
 * apparaît une seule fois, avec son codex et sa fiche publique. La route reste
 * pour les liens et les signets déjà partagés.
 */
definePageMeta({ layout: 'admin', middleware: 'admin' })
await navigateTo('/admin', { replace: true })
</script>

<template>
  <div class="py-16 text-center text-gray-500">Redirection vers la liste des armées…</div>
</template>
