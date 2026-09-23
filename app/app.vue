<template>
  <!-- Barre de progression en haut : pendant une navigation, la page précédente
       reste visible et c'est elle qui dit que quelque chose se passe. -->
  <NuxtLoadingIndicator color="rgb(var(--c-gold))" :height="4" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
