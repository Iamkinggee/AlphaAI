/**
 * AlphaAI App Configuration (Expo Dynamic Config)
 */
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? 'f76c7dcc-7c66-4f0c-8210-18ddf056770d';

  return {
  ...config,
  name: 'AlphaAI',
  slug: 'AlphaAI',
  version: '1.0.0',
   orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'alphaai',
  userInterfaceStyle: 'automatic',
  // @ts-ignore - Future SDK 54 properties
  newArchEnabled: true,

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.alphaai.app',
    infoPlist: {
      NSFaceIDUsageDescription: 'AlphaAI uses Face ID to secure your trading data',
    },
  },

  android: {
    adaptiveIcon: {
      backgroundColor: '#090E1A',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    // @ts-ignore - Future SDK 54 properties
    edgeToEdgeEnabled: true,
    package: 'com.alphaai.app',
  },

  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#090E1A',
        dark: {
          backgroundColor: '#090E1A',
        },
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/android-icon-monochrome.png',
        color: '#00D4FF',
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  ...(easProjectId
    ? {
        extra: {
          eas: {
            projectId: easProjectId,
          },
        },
      }
    : {}),
  };
};
