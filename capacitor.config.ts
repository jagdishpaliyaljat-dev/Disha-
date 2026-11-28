import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rajexam.prep',
  appName: 'Disha PYQ',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      '*.cashfree.com',
      'disha2020.in',
      'www.disha2020.in'
    ]
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#171329",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    SocialLogin: {
      google: {
        webClientId: '30041667176-63sq18vqm32a3fj465kb845ubc6cku44.apps.googleusercontent.com'
      }
    }
  }
};

export default config;
