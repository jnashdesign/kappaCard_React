/** Temporary experiment logging for QR visit / auto-vCard / Encounter flows. */
export function qrDevLog(message: string, detail?: unknown): void {
  const prefix = '[KappaCard QR]';
  if (detail !== undefined) {
    console.info(prefix, message, detail);
  } else {
    console.info(prefix, message);
  }
}
