import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // "prompt": o vendedor decide quando atualizar — nada recarrega sozinho
      // no meio de um pedido. O aviso vem do componente AtualizacaoPWA.
      registerType: "prompt",
      injectRegister: null, // o registro é feito por virtual:pwa-register/react

      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "logo-simbolo.png",
        "logo-carvalho-cruz.png",
      ],

      manifest: {
        id: "/",
        name: "CVC Hortifruit — Gestão",
        short_name: "CVC",
        description:
          "Gestão de vendas, clientes, fornecedores, estoque e financeiro da CVC Hortifruit, distribuidora de hortifrútis — Aracaju/SE.",
        lang: "pt-BR",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#FAFAF7",
        theme_color: "#2D6A4F",
        categories: ["business", "productivity"],
        // Gerados a partir da logo por `npm run icones`. O fundo é o creme da
        // marca — o mesmo `background_color` — porque a laranja e as folhas do
        // símbolo foram desenhadas para um fundo claro.
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff2}"],
        // As bibliotecas de exportação (xlsx, jspdf) só entram por import
        // dinâmico, quando alguém clica em "Exportar" — ver src/lib/exportar.js.
        // Pré-cachear o chunk delas no service worker anularia esse ganho: todo
        // instalador do PWA baixaria +1,2 MB sem nunca ter clicado em exportar.
        // Sem entrar no precache, o chunk é buscado da rede na primeira vez
        // que a função roda — só a exportação exige internet, não o resto do app.
        // O leitor de PDF (Anexar PDF em Vendas) segue a mesma lógica.
        globIgnores: ["**/exportar-relatorios-*.js", "**/leitor-pdf-*.js", "**/ocr/**", "**/tesseract*.js"],
        navigateFallback: "/index.html",
        // Sem isto, o service worker trata QUALQUER navegação de página
        // inteira (inclusive um link <a target="_blank"> pro PDF do DANFe)
        // como rota do SPA e serve o index.html por baixo — foi o que
        // fazia o link "NF 123" reabrir o próprio app em vez do PDF.
        // O link de pedido (/pedido/…) também fica de fora: ele não mostra o
        // aviso de "Nova versão", então num celular que já tem o app a cópia
        // guardada nunca se atualizaria. Ele precisa de internet de qualquer
        // jeito (fala com o Supabase), então vem sempre da rede, na versão nova.
        navigateFallbackDenylist: [/^\/api\//, /^\/pedido\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // As chamadas ao Supabase NÃO passam por cache do service worker:
            // o estado offline é responsabilidade do IndexedDB + fila de sync.
            // Guardar resposta velha aqui faria a sincronização ler dado furado.
            urlPattern: ({ url }) => url.pathname.startsWith("/rest/v1"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-arquivos",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        // Ligue para testar o comportamento offline com `npm run dev`.
        enabled: false,
        type: "module",
      },
    }),
  ],

  // O Vite não lê PORT por conta própria: sem isto ele ignora a porta que lhe
  // foi atribuída, cai na 5173 (ou na seguinte livre) e quem o iniciou fica
  // olhando uma porta vazia — foi o que aconteceu com o `autoPort` do
  // .claude/launch.json. Respeitar a variável resolve para painel de preview,
  // contêiner e qualquer outro chamador que escolha a porta.
  server: {
    // Permite abrir o app no celular pelo IP da máquina, na mesma rede.
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },

  preview: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },

  build: {
    sourcemap: true,
    modulePreload: {
      // Por padrão o Vite injeta <link rel="modulepreload"> até para chunks
      // de import() dinâmico, o que baixa o chunk de exportação (~1 MB) em
      // toda visita — o oposto do que o import dinâmico busca. Só ele fica
      // de fora do preload; carrega de verdade só quando alguém exporta.
      resolveDependencies: (_filename, deps) => deps.filter((d) => !d.includes("exportar-relatorios") && !d.includes("leitor-pdf") && !d.includes("tesseract")),
    },
    rollupOptions: {
      output: {
        // Um chunk só para as bibliotecas de exportação (xlsx, jspdf e o que
        // elas trazem junto) — nome previsível para o globIgnores acima poder
        // excluí-lo do precache do service worker.
        manualChunks(id) {
          if (/node_modules[\\/](xlsx|jspdf|jspdf-autotable|html2canvas|canvg|dompurify|raf|core-js|@babel[\\/]runtime)[\\/]/.test(id)) {
            return "exportar-relatorios";
          }
          // pdf.js (~1 MB), só para o "Anexar PDF" de Vendas.
          if (/node_modules[\\/]pdfjs-dist[\\/]/.test(id)) return "leitor-pdf";
        },
      },
    },
  },
});
