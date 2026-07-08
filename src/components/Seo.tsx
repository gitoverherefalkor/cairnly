import React from 'react';
import { Helmet } from 'react-helmet-async';
import {
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  absoluteImage,
  canonical,
} from '@/lib/seo';

interface SeoProps {
  /** Full, page-specific <title>. Falls back to the site default. */
  title?: string;
  /** Meta description (~150-160 chars ideal). Falls back to the site default. */
  description?: string;
  /** Route path for canonical + og:url, e.g. "/journal". Defaults to "/". */
  path?: string;
  /** Share image, root-relative ("/images/foo.png") or absolute. */
  image?: string;
  /** og:type — "website" for pages, "article" for journal posts. */
  type?: 'website' | 'article';
  /** When true, tells crawlers not to index this route (app/internal pages). */
  noindex?: boolean;
  /** One or more JSON-LD schema objects to embed in <head>. */
  jsonLd?: object | object[];
}

/**
 * Per-page <head> manager. Because Cairnly is a client-rendered SPA with a
 * single static index.html, every route otherwise shares the same title and
 * meta tags — which makes individual pages impossible to rank. This component
 * (backed by react-helmet-async) gives each page its own title, description,
 * canonical URL, Open Graph / Twitter cards, and structured data.
 */
const Seo: React.FC<SeoProps> = ({
  title,
  description,
  path = '/',
  image,
  type = 'website',
  noindex = false,
  jsonLd,
}) => {
  const pageTitle = title || DEFAULT_TITLE;
  const pageDescription = description || DEFAULT_DESCRIPTION;
  const url = canonical(path);
  const ogImage = absoluteImage(image);
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph (LinkedIn, Facebook, Slack, WhatsApp, iMessage) */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="Cairnly" />
      <meta property="og:image" content={ogImage} />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={ogImage} />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};

export default Seo;
