import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.della.app",
  appName: "DELLA",
  webDir: "out",
  bundledWebRuntime: false,
  server: {
    url: "https://app.dellaapp.com",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
