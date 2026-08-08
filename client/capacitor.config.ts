import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.subpilot.app',
  appName: 'SubPilot',
  webDir: 'dist',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
