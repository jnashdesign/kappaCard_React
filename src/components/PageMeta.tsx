import { useEffect } from 'react';

const SITE_ORIGIN = 'https://mykappacard.com';
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;
const DEFAULT_TITLE = 'Kappa Card — Never Forget A Brother Again';
const DEFAULT_DESCRIPTION =
  'Make lasting connections in less than 30 seconds. Share complete contact info with a single scan — branded Kappa Card, QR, and live profile.';
const STRUCTURED_DATA_ID = 'kappa-structured-data';

type PageMetaProps = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  imageAlt?: string;
  noIndex?: boolean;
  /** Optional person/profile fields for public card pages */
  person?: {
    name: string;
    username?: string;
    chapter?: string;
    initiationYear?: string | number;
    image?: string;
  };
};

function upsertMeta(
  attr: 'name' | 'property',
  key: string,
  content: string
): void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string, attrs?: Record<string, string>): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
  }
}

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return `${SITE_ORIGIN}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

function upsertStructuredData(data: Record<string, unknown>): void {
  let el = document.getElementById(STRUCTURED_DATA_ID) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = STRUCTURED_DATA_ID;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function buildStructuredData({
  title,
  description,
  url,
  image,
  noIndex,
  person,
}: {
  title: string;
  description: string;
  url: string;
  image: string;
  noIndex: boolean;
  person?: PageMetaProps['person'];
}): Record<string, unknown> {
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'Kappa Card',
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/favicon.png`,
      image: DEFAULT_OG_IMAGE,
      description: DEFAULT_DESCRIPTION,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      url: `${SITE_ORIGIN}/`,
      name: 'Kappa Card',
      description: DEFAULT_DESCRIPTION,
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      inLanguage: 'en-US',
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_ORIGIN}/#app`,
      name: 'Kappa Card',
      url: `${SITE_ORIGIN}/`,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'Share a branded fraternity contact card with a live QR profile and Add to Contacts.',
      offers: {
        '@type': 'Offer',
        url: `${SITE_ORIGIN}/pricing`,
        price: '9.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      about: { '@id': `${SITE_ORIGIN}/#app` },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: image,
      },
      inLanguage: 'en-US',
      ...(noIndex ? { robots: 'noindex' } : {}),
    },
  ];

  if (person?.name) {
    graph.push({
      '@type': 'ProfilePage',
      '@id': `${url}#profile`,
      url,
      name: title,
      description,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      mainEntity: {
        '@type': 'Person',
        name: person.name,
        url,
        ...(person.image ? { image: person.image } : {}),
        ...(person.username
          ? { identifier: person.username, alternateName: `@${person.username}` }
          : {}),
        ...(person.chapter || person.initiationYear
          ? {
              alumniOf: {
                '@type': 'Organization',
                name: [person.chapter, person.initiationYear]
                  .filter(Boolean)
                  .join(' '),
              },
            }
          : {}),
      },
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

/**
 * Updates document title + description / Open Graph / Twitter tags for the active route.
 * Static defaults live in index.html for first paint and non-JS crawlers.
 */
export default function PageMeta({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_OG_IMAGE,
  imageAlt = 'Kappa Card phone mockup showing a branded digital member card',
  noIndex = false,
  person,
}: PageMetaProps) {
  useEffect(() => {
    const url = absoluteUrl(path);

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta(
      'name',
      'robots',
      noIndex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    );
    upsertMeta(
      'name',
      'googlebot',
      noIndex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    );
    upsertLink('canonical', url);
    upsertLink('sitemap', `${SITE_ORIGIN}/sitemap.xml`, {
      type: 'application/xml',
      title: 'Sitemap',
    });

    upsertMeta('property', 'og:type', person ? 'profile' : 'website');
    upsertMeta('property', 'og:site_name', 'Kappa Card');
    upsertMeta('property', 'og:locale', 'en_US');
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:image:secure_url', image);
    upsertMeta('property', 'og:image:alt', imageAlt);
    if (person?.username) {
      upsertMeta('property', 'profile:username', person.username);
    } else {
      document.head.querySelector('meta[property="profile:username"]')?.remove();
    }
    if (image === DEFAULT_OG_IMAGE) {
      upsertMeta('property', 'og:image:type', 'image/png');
      upsertMeta('property', 'og:image:width', '1200');
      upsertMeta('property', 'og:image:height', '630');
    } else {
      document.head.querySelector('meta[property="og:image:type"]')?.remove();
      document.head.querySelector('meta[property="og:image:width"]')?.remove();
      document.head.querySelector('meta[property="og:image:height"]')?.remove();
    }

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:url', url);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', image);
    upsertMeta('name', 'twitter:image:alt', imageAlt);

    upsertStructuredData(
      buildStructuredData({ title, description, url, image, noIndex, person })
    );
  }, [
    title,
    description,
    path,
    image,
    imageAlt,
    noIndex,
    person?.name,
    person?.username,
    person?.chapter,
    person?.initiationYear,
    person?.image,
  ]);

  return null;
}

export { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, DEFAULT_TITLE, SITE_ORIGIN };
