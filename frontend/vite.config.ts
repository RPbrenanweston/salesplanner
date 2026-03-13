import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000
  },
  build: {
    rollupOptions: {
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
