/**
 * Journal article registry.
 *
 * Each article is a Markdown file in `./articles/` with a flat YAML
 * frontmatter block. A research/journal agent can autopost simply by dropping
 * a new `.md` file in that folder — it appears in the Journal index
 * automatically, no code change required.
 *
 * Frontmatter fields (all optional unless noted):
 *   slug*            kebab-case URL slug
 *   title*           article title
 *   status*          featured | published | coming-soon
 *   publishedAt      ISO date (YYYY-MM-DD)
 *   readingTime      minutes (number)
 *   sourceCount      number of cited sources
 *   topics           comma-separated chip labels
 *   category         single label, e.g. "Methodology note"
 *   excerpt*         1-2 sentence summary
 *   reportNumber     e.g. "01"
 *   reportLabel      e.g. "Cairnly Research · Report 01"
 *   featuredStatNumber / featuredStatCaption / featuredStatSource
 *   authorName / authorLocation
 */

export type ArticleStatus = 'featured' | 'published' | 'coming-soon';

export interface JournalArticle {
  slug: string;
  title: string;
  status: ArticleStatus;
  publishedAt?: string;
  readingTime?: number;
  sourceCount?: number;
  topics: string[];
  category?: string;
  excerpt: string;
  reportNumber?: string;
  reportLabel?: string;
  featuredStatNumber?: string;
  featuredStatCaption?: string;
  featuredStatSource?: string;
  authorName?: string;
  authorLocation?: string;
  body: string;
}

interface Parsed {
  data: Record<string, string>;
  body: string;
}

/** Minimal flat YAML-frontmatter parser (key: value lines only). */
function parseFrontmatter(raw: string): Parsed {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return { data, body: match[2].trim() };
}

function toArticle({ data, body }: Parsed): JournalArticle {
  const status = (data.status as ArticleStatus) || 'published';
  return {
    slug: data.slug || '',
    title: data.title || 'Untitled',
    status,
    publishedAt: data.publishedAt,
    readingTime: data.readingTime ? Number(data.readingTime) : undefined,
    sourceCount: data.sourceCount ? Number(data.sourceCount) : undefined,
    topics: data.topics ? data.topics.split(',').map((t) => t.trim()).filter(Boolean) : [],
    category: data.category,
    excerpt: data.excerpt || '',
    reportNumber: data.reportNumber,
    reportLabel: data.reportLabel,
    featuredStatNumber: data.featuredStatNumber,
    featuredStatCaption: data.featuredStatCaption,
    featuredStatSource: data.featuredStatSource,
    authorName: data.authorName,
    authorLocation: data.authorLocation,
    body,
  };
}

const STATUS_ORDER: Record<ArticleStatus, number> = {
  featured: 0,
  published: 1,
  'coming-soon': 2,
};

const rawFiles = import.meta.glob('./articles/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const articles: JournalArticle[] = Object.values(rawFiles)
  .map((raw) => toArticle(parseFrontmatter(raw)))
  .sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return (b.publishedAt || '').localeCompare(a.publishedAt || '');
  });

/** The single featured article shown in the Journal hero card. */
export const featuredArticle: JournalArticle | undefined = articles.find(
  (a) => a.status === 'featured'
);

/** Everything that isn't the featured card, for the "More writing" grid. */
export const otherArticles: JournalArticle[] = articles.filter(
  (a) => a.status !== 'featured'
);

export function getArticle(slug: string): JournalArticle | undefined {
  return articles.find((a) => a.slug === slug);
}
