// Nombre provisorio: se cambia acá o con NEXT_PUBLIC_APP_NAME.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Planes";

// Rosario está en la zona America/Argentina/Cordoba. Argentina no usa horario de verano.
export const TIME_ZONE = "America/Argentina/Cordoba";
export const ARGENTINA_UTC_OFFSET = "-03:00";

// Centro para sesgar las sugerencias de direcciones.
export const MAP_CENTER = { lat: -32.9468, lng: -60.6393 };

export const REDEMPTION_VALID_MINUTES = 30;
