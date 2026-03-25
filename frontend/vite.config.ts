import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const isPlanner = process.env.VITE_APP === 'planner'

export default defineConfig({
  plugins: [
    react(),
    // In planner mode, rewrite root URL to serve index-planner.html
    ...(isPlanner
      ? [{
          name: 'planner-root-rewrite',
          configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: unknown, next: () => void) => void) => void } }) {
            server.middlewares.use((req, _res, next) => {
              // Rewrite all non-asset routes to serve index-planner.html (SPA fallback)
              const url = req.url || ''
              const isAsset = url.startsWith('/src/') || url.startsWith('/node_modules/') || url.startsWith('/@') || url.includes('.')
              if (!isAsset) {
                req.url = '/index-planner.html'
              }
              next()
            })
          },
        }]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000
  },
  build: {
    rollupOptions: {
      input: isPlanner
        ? path.resolve(__dirname, 'index-planner.html')
        : path.resolve(__dirname, 'index.html'),
      output: {
        manualChunks: {
          // Vendor chunks for heavy dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['lucide-react', '@hello-pangea/dnd'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder'],

          // Feature chunks
          'chunk-auth': [
            './src/pages/SignIn.tsx',
            './src/pages/SignUp.tsx',
            './src/pages/ForgotPassword.tsx',
          ],
          'chunk-contacts': [
            './src/pages/Lists.tsx',
            './src/pages/ListDetailPage.tsx',
            './src/pages/ContactDetailPage.tsx',
          ],
          'chunk-activities': [
            './src/pages/Email.tsx',
            './src/pages/Social.tsx',
            './src/pages/Pipeline.tsx',
          ],
          'chunk-analytics': [
            './src/pages/Analytics.tsx',
            './src/pages/Goals.tsx',
          ],
          'chunk-admin': [
            './src/pages/Team.tsx',
            './src/pages/SettingsPage.tsx',
            './src/pages/Scripts.tsx',
            './src/pages/EmailTemplates.tsx',
          ],
        },
      },
    },
    // Increase chunk size warning limit since we're handling it with code splitting
    chunkSizeWarningLimit: 1000,
  },
})
