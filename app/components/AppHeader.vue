<script setup lang="ts">
const mobileMenuOpen = ref(false)
const route = useRoute()

watch(() => route.fullPath, () => {
  mobileMenuOpen.value = false
})

const navLinks = [
  { label: 'Accueil', to: '/' },
  {
    label: "Livres d'Armées",
    to: '/armees',
    children: [
      { label: 'Toutes les armées', to: '/armees' },
      { label: 'Armées de l\'Imperium', to: '/armees/imperium' },
      { label: 'Armées du Chaos', to: '/armees/chaos' },
      { label: 'Armées Xenos', to: '/armees/xenos' },
      { label: 'Bêta & Expérimentaux', to: '/codex-beta' },
      { label: 'Epic 30k — Horus Hérésie', to: '/epic-30k' },
    ],
  },
  { label: 'Règles & FAQ', to: '/regles' },
  { label: 'Événements', to: '/evenements' },
  { label: 'Outils', to: '/outils' },
  { label: 'Communauté', to: '/communaute' },
]

const openDropdown = ref<string | null>(null)
let closeTimeout: ReturnType<typeof setTimeout> | null = null

function openMenu(label: string) {
  if (closeTimeout) {
    clearTimeout(closeTimeout)
    closeTimeout = null
  }
  openDropdown.value = label
}

function closeMenu() {
  closeTimeout = setTimeout(() => {
    openDropdown.value = null
  }, 150)
}

function toggleDropdown(label: string) {
  openDropdown.value = openDropdown.value === label ? null : label
}
</script>

<template>
  <header class="fixed top-0 left-0 right-0 z-50 border-b border-gold/20 bg-surface/95 backdrop-blur-sm">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
      <!-- Logo -->
      <NuxtLink to="/" class="flex items-center gap-3">
        <span class="font-logo text-xl tracking-wider text-gold sm:text-2xl">EPIC ARMAGEDDON</span>
      </NuxtLink>

      <!-- Desktop nav -->
      <nav class="hidden items-center gap-1 lg:flex">
        <template v-for="link in navLinks" :key="link.label">
          <!-- Simple link -->
          <NuxtLink
            v-if="!link.children"
            :to="link.to"
            class="rounded-md px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-surface-lighter hover:text-gold"
            active-class="!text-gold"
          >
            {{ link.label }}
          </NuxtLink>

          <!-- Dropdown -->
          <div v-else class="relative" @mouseenter="openMenu(link.label)" @mouseleave="closeMenu()">
            <NuxtLink
              :to="link.to"
              class="flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-surface-lighter hover:text-gold"
              active-class="!text-gold"
            >
              {{ link.label }}
              <svg class="h-4 w-4 transition-transform" :class="{ 'rotate-180': openDropdown === link.label }" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            </NuxtLink>
            <!-- Invisible bridge to prevent gap between button and dropdown -->
            <div class="absolute left-0 top-full h-2 w-full" />
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="scale-95 opacity-0"
              enter-to-class="scale-100 opacity-100"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="scale-100 opacity-100"
              leave-to-class="scale-95 opacity-0"
            >
              <div
                v-show="openDropdown === link.label"
                class="absolute left-0 top-full mt-2 w-56 rounded-lg border border-gold/10 bg-surface-light p-2 shadow-xl"
              >
                <NuxtLink
                  v-for="child in link.children"
                  :key="child.label"
                  :to="child.to"
                  class="block rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-surface-lighter hover:text-gold"
                >
                  {{ child.label }}
                </NuxtLink>
              </div>
            </Transition>
          </div>
        </template>
      </nav>

      <!-- Mobile menu button -->
      <button
        class="rounded-md p-2.5 text-gray-300 hover:text-gold lg:hidden"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <svg v-if="!mobileMenuOpen" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

  </header>

  <!-- Mobile nav overlay -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileMenuOpen" class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden" @click="mobileMenuOpen = false" />
    </Transition>
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <nav
        v-if="mobileMenuOpen"
        class="fixed top-0 right-0 bottom-0 z-[70] flex w-[280px] flex-col overflow-y-auto border-l border-gold/15 bg-surface lg:hidden"
      >
        <!-- Close button -->
        <div class="flex items-center justify-between border-b border-gold/10 px-5 py-4">
          <span class="font-logo text-lg tracking-wider text-gold">Menu</span>
          <button class="rounded-md p-2 text-gray-400 hover:text-gold" @click="mobileMenuOpen = false">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Links -->
        <div class="flex-1 px-3 py-4">
          <template v-for="link in navLinks" :key="link.label">
            <NuxtLink
              v-if="!link.children"
              :to="link.to"
              class="flex items-center rounded-lg px-4 py-3 text-[15px] font-medium text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-gold"
              active-class="!text-gold bg-gold/5"
            >
              {{ link.label }}
            </NuxtLink>

            <div v-else>
              <button
                class="flex w-full items-center justify-between rounded-lg px-4 py-3 text-[15px] font-medium text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-gold"
                @click="toggleDropdown(link.label)"
              >
                {{ link.label }}
                <svg class="h-4 w-4 transition-transform duration-200" :class="{ 'rotate-180': openDropdown === link.label }" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                </svg>
              </button>
              <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-1"
              >
                <div v-show="openDropdown === link.label" class="mb-2 ml-3 space-y-0.5 border-l border-gold/10 pl-3">
                  <NuxtLink
                    v-for="child in link.children"
                    :key="child.label"
                    :to="child.to"
                    class="block rounded-md px-3 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-gold"
                    active-class="!text-gold"
                  >
                    {{ child.label }}
                  </NuxtLink>
                </div>
              </Transition>
            </div>
          </template>
        </div>

        <!-- Bottom brand -->
        <div class="border-t border-gold/10 px-5 py-4">
          <span class="font-logo text-xs tracking-wider text-gold/40">EPIC ARMAGEDDON FR</span>
        </div>
      </nav>
    </Transition>
  </Teleport>
</template>
