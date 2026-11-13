/**
 * Site-wide settings. Live values are written here so the GitHub Pages build
 * needs no secrets; an environment variable with the same name (see
 * .env.example) overrides each one for local testing.
 */

/**
 * Google AdSense publisher ID, e.g. 'ca-pub-1234567890123456'.
 * Leave empty until the site is live and you are ready to apply: while it is
 * empty, no ad code, ads.txt or advertising section of the privacy policy is
 * published. Paste the ID here (and the ad unit slot IDs below) to switch ads on.
 */
const ADSENSE_PUBLISHER_ID = 'ca-pub-4755228056332298';

export const site = {
  name: 'Veylora',
  tagline: 'The interactive science lab',
  description:
    'Veylora is a free interactive science lab. Explore biology, chemistry, physics, anatomy, astronomy and more through hands-on simulations, clear explanations and quizzes.',
  /** The live address of the site. */
  url: 'https://veyloralab.tech',
  /** The person who builds and runs the site (shown on the About page). */
  creator: {
    name: 'Kyle C. Leyson',
    initials: 'KL',
    role: 'Bachelor of Science in Information Technology (BSIT) student at Cebu Eastern College',
  },
  /** Where the Terms of use are governed. */
  jurisdiction: 'the Republic of the Philippines',
  venue: 'Cebu City, Philippines',
  /**
   * Contact form endpoint (Formspree). All messages, including legal and
   * privacy questions, go through the form: no email address is published.
   */
  contactEndpoint: (import.meta.env.PUBLIC_CONTACT_ENDPOINT as string | undefined) || 'https://formspree.io/f/xyewzywl',
  adsenseClient: (import.meta.env.PUBLIC_ADSENSE_CLIENT as string | undefined) || ADSENSE_PUBLISHER_ID || undefined,
  /** AdSense ad unit IDs for the three reserved slots (created in your AdSense account). */
  adsenseSlots: {
    top: (import.meta.env.PUBLIC_ADSENSE_SLOT_TOP as string | undefined) || '4682046573',
    sidebar: (import.meta.env.PUBLIC_ADSENSE_SLOT_SIDEBAR as string | undefined) || '2306009722',
    mid: (import.meta.env.PUBLIC_ADSENSE_SLOT_MID as string | undefined) || '7574648276',
  },
  /** Date shown on legal pages. Update when you change them. */
  legalUpdated: 'November 12, 2026',
};
