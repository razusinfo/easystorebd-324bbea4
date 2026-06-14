import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nusrattelecom.bongoinventory',
  appName: 'Bongo Inventory',
  // For Play Store release: run `bun run build`, then point this to the static
  // build output (e.g. 'dist/client'). For instant live-reload during development,
  // keep the `server.url` below pointing to your Lovable preview URL.
  webDir: 'dist/client',
  server: {
    // Live-reload from the Lovable sandbox preview. Remove this whole `server`
    // block before producing a signed release APK/AAB for the Play Store.
    url: 'https://id-preview--c20fa2cc-c189-439f-a5c3-c8d099d047fd.lovable.app',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1E1B4B',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#1E1B4B',
      style: 'DARK',
    },
  },
};

export default config;
