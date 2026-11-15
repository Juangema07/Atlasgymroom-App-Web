import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages needs its repository prefix; Capacitor must use relative
// bundled asset paths so the APK loads its own local web build.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true'

export default defineConfig({
  plugins: [react()],
  base: isCapacitorBuild ? './' : '/Atlasgymroom-App-Web/',
})
