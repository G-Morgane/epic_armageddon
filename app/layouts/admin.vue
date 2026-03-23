<script setup lang="ts">
const route = useRoute()
const { profile, logout, isSuperAdmin } = useAuth()

const navItems = computed(() => {
  const items = [
    { label: 'Armées', to: '/admin', icon: 'shield' },
    { label: 'Outils', to: '/admin/tools', icon: 'wrench' },
    { label: 'Documents', to: '/admin/documents', icon: 'document' },
    { label: 'Événements', to: '/admin/events', icon: 'calendar' },
  ]
  if (isSuperAdmin.value) {
    items.push({ label: 'Utilisateurs', to: '/admin/users', icon: 'users' })
  }
  return items
})

function isActive(to: string) {
  if (to === '/admin') return route.path === '/admin'
  return route.path.startsWith(to)
}
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <!-- Sidebar -->
    <aside class="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-gold/10 bg-surface-light">
      <!-- Logo -->
      <div class="flex items-center gap-3 border-b border-gold/10 px-6 py-5">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10">
          <span class="font-heading text-lg font-bold text-gold">EA</span>
        </div>
        <div>
          <p class="text-sm font-bold text-gold">Epic Armageddon</p>
          <p class="text-xs text-gray-500">Administration</p>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 space-y-1 px-3 py-4">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="[
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
            isActive(item.to)
              ? 'bg-gold/10 text-gold'
              : 'text-gray-400 hover:bg-surface-lighter hover:text-gray-200',
          ]"
        >
          <!-- Icons -->
          <svg v-if="item.icon === 'shield'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          <svg v-else-if="item.icon === 'wrench'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17l-5.1-5.1a3.12 3.12 0 010-4.41l.71-.71a3.12 3.12 0 014.41 0l.71.71.71-.71a3.12 3.12 0 014.41 0l.71.71a3.12 3.12 0 010 4.41l-5.1 5.1a1.5 1.5 0 01-2.12 0zM21.13 21.13l-2.83-2.83" /></svg>
          <svg v-else-if="item.icon === 'document'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
          <svg v-else-if="item.icon === 'calendar'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
          <svg v-else-if="item.icon === 'users'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- User section -->
      <div class="border-t border-gold/10 px-4 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-lighter text-sm font-semibold text-gray-400">
            {{ (profile?.display_name ?? profile?.email ?? '?')[0].toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="truncate text-sm font-medium text-gray-200">{{ profile?.display_name ?? profile?.email }}</p>
            <p class="text-xs text-gold/70">{{ profile?.role === 'super_admin' ? 'Super Admin' : 'Admin' }}</p>
          </div>
        </div>
        <div class="mt-3 flex gap-2">
          <NuxtLink
            to="/"
            class="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-center text-xs text-gray-400 transition-colors hover:bg-surface-lighter hover:text-gray-200"
          >
            Voir le site
          </NuxtLink>
          <button
            class="flex-1 rounded-lg border border-red-500/10 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
            @click="logout"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="ml-64 flex-1 px-8 py-8">
      <slot />
    </main>
  </div>
</template>
