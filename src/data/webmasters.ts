export const WEBMASTERS = [
  {
    name: 'Stefano Aguiar',
    email: 'stefano@stefanoaguiar.com',
  },
] as const;

/** Flat list of notification emails (extend WEBMASTERS to add more). */
export function getWebmasterEmails(): string[] {
  return WEBMASTERS.map((w) => w.email);
}
