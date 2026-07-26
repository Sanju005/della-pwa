import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.della.app",
  appName: "DELLA",
  webDir: "out",
  server: {
    url: "https://app.myswiper.my",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
