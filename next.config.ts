import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// En desarrollo, permite abrir la app desde celulares de la misma red wifi (http://192.168.x.x:3000)
// para probar el QR antes de publicarla.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((network) => network?.family === "IPv4" && !network.internal)
  .map((network) => network!.address);

const nextConfig: NextConfig = {
  cacheComponents: true,
  allowedDevOrigins: ["127.0.0.1", ...lanAddresses],
};

export default nextConfig;
