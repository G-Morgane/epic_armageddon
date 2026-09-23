export type Theme = 'clair' | 'sombre'

/**
 * Thème clair / sombre. La classe `dark` de <html> est posée par le script
 * inline de nuxt.config.ts avant le premier rendu : le serveur ne connaît
 * jamais le choix, on le relit donc depuis le DOM une fois monté.
 */
export function useTheme() {
  const theme = useState<Theme>('theme', () => 'sombre')

  onMounted(() => {
    theme.value = document.documentElement.classList.contains('dark') ? 'sombre' : 'clair'
  })

  function basculer() {
    const suivant: Theme = theme.value === 'sombre' ? 'clair' : 'sombre'
    theme.value = suivant
    document.documentElement.classList.toggle('dark', suivant === 'sombre')
    try {
      localStorage.theme = suivant
    } catch {
      // navigation privée ou stockage refusé : le thème tient jusqu'au rechargement
    }
  }

  return { theme, basculer }
}
