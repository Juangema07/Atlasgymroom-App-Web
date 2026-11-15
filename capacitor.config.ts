import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.atlasgymrun.admin',
  appName: 'Atlasgymrun',
  webDir: 'dist',
  server: {
    // The native app is a companion window to the hosted web system.
    // Shared records always come from the same web backend.
    url: 'https://juangema07.github.io/Atlasgymrun-App-Web/',
    cleartext: false,
    androidScheme: 'https',
  },
  android: { allowMixedContent: false },
}

export default config
