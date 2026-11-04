/**
 * Site-wide settings. Values that depend on your deployment are read from
 * environment variables (see .env.example) so nothing is hard-coded or
 * claimed before it is actually set up.
 */
export const site = {
  name: 'Veylora',
  tagline: 'The interactive science lab',
  description:
    'Veylora is a free interactive science lab. Explore biology, chemistry, physics, anatomy, astronomy and more through hands-on simulations, clear explanations and quizzes.',
  /** Public contact email. Leave unset to hide it. */
  contactEmail: import.meta.env.PUBLIC_CONTACT_EMAIL as string | undefined,
  /** Form endpoint (e.g. Formspree, Basin, Getform). Leave unset and the form explains it is not connected yet. */
  contactEndpoint: import.meta.env.PUBLIC_CONTACT_ENDPOINT as string | undefined,
  /** Google AdSense publisher ID, e.g. ca-pub-1234567890123456. Leave unset to load no ad code at all. */
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT as string | undefined,
  /** Date shown on legal pages. Update when you change them. */
  legalUpdated: 'November 4, 2026',
};
