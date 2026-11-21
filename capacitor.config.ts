import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.disha2020.examprep',
  appName: 'Disha 20-20',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#FFF9EF",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    SocialLogin: {
      google: {
        webClientId: '30041667176-vftn1ar5sj8qmtsv3rh81hl11kdd18b0.apps.googleusercontent.com'
      }
    }
  }
};

export default config;
