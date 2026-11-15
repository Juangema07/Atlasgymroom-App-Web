import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.atlasgymrun.admin',
  appName: 'Atlasgymrun',
  webDir: 'dist',
  // No remote server.url: Android packages and runs its own built interface.
  // Supabase remains the shared backend for web and Android.
  android: { allowMixedContent: false },
}

export default config
