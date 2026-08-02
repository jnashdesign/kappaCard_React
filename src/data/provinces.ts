/** Official provinces of Kappa Alpha Psi Fraternity, Inc. (12). */
export const KAPPA_PROVINCES = [
  'East Central',
  'Eastern',
  'Middle Eastern',
  'Middle Western',
  'North Central',
  'Northeastern',
  'Northern',
  'South Central',
  'Southeastern',
  'Southern',
  'Southwestern',
  'Western',
] as const;

export type KappaProvince = (typeof KAPPA_PROVINCES)[number];

export default KAPPA_PROVINCES;
