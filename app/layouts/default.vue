<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="flex-1 pt-[72px]">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
