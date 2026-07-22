declare const __SCHEMATICA_VERSION__: string | undefined;

export const appVersion =
  typeof __SCHEMATICA_VERSION__ === "string" && __SCHEMATICA_VERSION__.length > 0
    ? __SCHEMATICA_VERSION__
    : "0.0.0-dev";
