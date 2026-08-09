/** Temporary experiment logging for QR → auto vCard behavior. */
export function qrDevLog(message: string, detail?: unknown): void {
  const prefix = '[KappaCard QR]';
  if (detail !== undefined) {
    console.info(prefix, message, detail);
  } else {
    console.info(prefix, message);
  }
}
