// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/sitemap'],
  site: {
    url: 'https://www.epicarmageddon.fr',
    name: 'Epic Armageddon FR',
  },
  sitemap: {
    exclude: ['/admin/**'],
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },
  nitro: {
    // Codex YAML (source de vérité) embarqués dans le serveur
    serverAssets: [{ baseName: 'codex', dir: '../content/codex' }],
    // Génération de PDF : Chromium met quelques secondes à démarrer sur Vercel
    vercel: { functions: { maxDuration: 60 } },
  },
  app: {
    head: {
      htmlAttrs: { class: 'dark', lang: 'fr' },
      titleTemplate: '%s — Epic Armageddon FR',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Communauté française Epic Armageddon — Codex d\'armées, règles, FAQ, événements et outils pour le jeu de figurines Epic à l\'échelle 6mm.' },
        { property: 'og:site_name', content: 'Epic Armageddon FR' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'fr_FR' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Oswald:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
  runtimeConfig: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    public: {
      // Démo locale uniquement : contourne la connexion admin pour les écrans Codex (jamais actif en build de prod)
      codexDemoSansAuth: process.env.CODEX_DEMO_SANS_AUTH === '1',
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      r2PublicUrl: process.env.R2_PUBLIC_URL,
      siteUrl: 'https://www.epicarmageddon.fr',
    },
  },
})
