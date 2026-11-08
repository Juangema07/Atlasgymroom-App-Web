import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.atlasgymroom.admin',
  appName: 'Atlasgymroom',
  webDir: 'dist',
  server: {
    // The native app is a companion window to the hosted web system.
    // Shared records always come from the same web backend.
    url: 'https://juangema07.github.io/Atlasgymroom-App-Web/',
    cleartext: false,
    androidScheme: 'https',
  },
  android: { allowMixedContent: false },
}

export default config
