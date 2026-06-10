export const APP_VERSION = '0.9.0';
// Baked in at build time via deploy workflow; null in local dev.
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE || null;
