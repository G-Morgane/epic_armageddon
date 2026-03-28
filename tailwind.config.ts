import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Fond principal très sombre avec nuance brune
        surface: {
          DEFAULT: '#1a1210',
          light: '#241c18',
          lighter: '#2e2420',
        },
        // Accent doré/ambre (inspiré des maquettes GamerPro)
        gold: {
          DEFAULT: '#c8a052',
          light: '#dbb86e',
          dark: '#a07830',
        },
      },
      fontFamily: {
        heading: ['Oswald', 'sans-serif'],
        logo: ['Black Ops One', 'sans-serif'],
        body: ['Crimson Text', 'serif'],
      },
    },
  },
} satisfies Config
