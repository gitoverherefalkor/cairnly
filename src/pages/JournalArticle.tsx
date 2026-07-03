import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Clock, Calendar, User, FileText, ArrowRight } from 'lucide-react';
import '../components/landing/landing.css';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import { getArticle, type JournalArticle as JournalArticleMeta } from '@/content/journal';
import ShareVisualButton from '@/components/journal/ShareVisualButton';
import type {
  Chapter,
  Source,
  StatGridEntry,
} from '@/content/journal/bodies/career-uncertainty-report';

interface ArticleBody {
  description: string;
  introContent: React.ReactNode;
  statGrid: StatGridEntry[];
  chapters: Chapter[];
  sources: Source[];
  methodology: string;
}

// Eagerly bundle every article body module so the page can switch by slug.
const bodyModules = import.meta.glob<ArticleBody>('../content/journal/bodies/*.tsx', { eager: true });

function getBody(slug: string): ArticleBody | undefined {
  const key = `../content/journal/bodies/${slug}.tsx`;
  return bodyModules[key];
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderHeroTitle(slug: string, title: string) {
  if (slug === 'career-uncertainty-report') {
    return (
      <>
        The Career <br />Uncertainty <span className="lp-text-gold-grad">Report.</span>
      </>
    );
  }
  const words = title.split(' ');
  const last = words.pop() || '';
  return (
    <>
      {words.join(' ')} <span className="lp-text-gold-grad">{last}</span>
    </>
  );
}

const NotFoundShell: React.FC = () => (
  <div className="min-h-screen font-sans overflow-x-clip" style={{ background: '#F4ECDA', color: '#122E3B' }}>
    <LandingNav variant="page" />
    <section className="bg-[#213F4F] text-white py-32">
      <div className="lp-container text-center">
        <div className="lp-eyebrow text-[#D4A024] mb-4">Article not found</div>
        <h1 className="font-heading font-bold text-4xl mb-6">This entry doesn't exist yet.</h1>
        <Link to="/journal" className="lp-btn-primary inline-flex">
          Back to the Journal
          <ArrowRight size={18} strokeWidth={2.4} />
        </Link>
      </div>
    </section>
    <LandingFooter />
  </div>
);

const TocItem: React.FC<{ id: string; num: string; label: string; current: string }> = ({ id, num, label, current }) => (
  <button
    type="button"
    onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    className={`lp-toc__item${current === id ? ' is-current' : ''}`}
  >
    <span className="lp-num">{num}</span>
    {label}
  </button>
);

const JournalArticle: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const meta = getArticle(slug) as JournalArticleMeta | undefined;
  const body = getBody(slug);
  const [currentId, setCurrentId] = useState('intro');

  useEffect(() => {
    if (!body) return;
    const ids = ['intro', ...body.chapters.map((c) => c.id), 'sources'];
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setCurrentId(e.target.id);
        });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [body]);

  // Scroll to top when the slug changes (e.g. navigating from one article to another).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!meta || !body) return <NotFoundShell />;

  const siteUrl = 'https://cairnly.io';
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: body.description,
    image: `${siteUrl}/og/${meta.slug}.png`,
    datePublished: meta.publishedAt,
    dateModified: meta.publishedAt,
    author: {
      '@type': 'Organization',
      name: meta.authorName || 'The Cairnly team',
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Cairnly',
      logo: { '@type': 'ImageObject', url: `${siteUrl}/cairnly-logo.png` },
    },
    mainEntityOfPage: `${siteUrl}/journal/${meta.slug}`,
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Journal', item: `${siteUrl}/journal` },
      { '@type': 'ListItem', position: 3, name: meta.title, item: `${siteUrl}/journal/${meta.slug}` },
    ],
  };

  return (
    <div className="min-h-screen font-sans overflow-x-clip" style={{ background: '#F4ECDA', color: '#122E3B' }}>
      <LandingNav variant="page" />

      {/* Article hero */}
      <header className="bg-[#213F4F] text-white pt-14 md:pt-20 pb-20 md:pb-24 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: 'rgba(39,161,161,0.12)', filter: 'blur(120px)', marginRight: -300, marginTop: -200 }}
        />
        <div className="lp-container relative z-10">
          <div className="flex items-center gap-3 mb-10 text-[10px] font-heading font-bold tracking-[0.22em] uppercase">
            <Link to="/journal" className="text-[#D4A024] hover:text-[#F0C040] transition-colors">
              Journal
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white/60">{meta.reportLabel || 'Cairnly Research'}</span>
          </div>

          <h1
            className="font-heading font-bold leading-[1.05] max-w-4xl"
            style={{ fontSize: 'clamp(34px, 5.5vw, 76px)', letterSpacing: '-0.025em' }}
          >
            {renderHeroTitle(meta.slug, meta.title)}
          </h1>

          <p className="mt-10 text-lg md:text-xl text-white/70 font-medium leading-relaxed max-w-3xl">
            {body.description}
          </p>

          <div className="mt-12 pt-6 border-t border-white/10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[12.5px] font-medium text-white/55">
            {meta.readingTime && (
              <span className="flex items-center gap-2"><Clock size={14} strokeWidth={1.8} />{meta.readingTime} min read</span>
            )}
            {meta.publishedAt && (
              <span className="flex items-center gap-2"><Calendar size={14} strokeWidth={1.8} />Published {formatDate(meta.publishedAt)}</span>
            )}
            {meta.authorName && (
              <span className="flex items-center gap-2">
                <User size={14} strokeWidth={1.8} />
                By {meta.authorName}{meta.authorLocation ? `, ${meta.authorLocation}` : ''}
              </span>
            )}
            {meta.sourceCount && (
              <span className="flex items-center gap-2"><FileText size={14} strokeWidth={1.8} />{meta.sourceCount} sources cited</span>
            )}
          </div>
        </div>
      </header>

      {/* Top-eight stat callout */}
      <section className="bg-[#FAF5E8] py-16 md:py-20">
        <div className="lp-container">
          <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div className="max-w-3xl">
              <div className="lp-eyebrow text-[#1F8282] mb-4">The eight findings</div>
              <h2
                className="font-heading font-bold text-[#122E3B] leading-[1.15]"
                style={{ fontSize: 'clamp(24px, 2.8vw, 36px)', letterSpacing: '-0.012em' }}
              >
                If you only read this part.
              </h2>
            </div>
            <ShareVisualButton
              shareUrl={`${siteUrl}/journal/${meta.slug}`}
              title={meta.title}
              text="Eight findings on burnout, disengagement, and career regret. Read the full report."
              imageSrc={meta.slug === 'career-uncertainty-report' ? '/images/career-uncertainty-stats.svg' : undefined}
              fileName="cairnly-career-uncertainty.png"
            />
          </div>
          <div className="lp-stat-grid">
            {body.statGrid.map((cell) => (
              <div key={cell.number + cell.source} className="lp-stat-cell">
                <div>
                  <div className="lp-stat-cell__num"><span className="lp-accent">{cell.number}</span></div>
                  <div className="lp-stat-cell__desc mt-4">{cell.description}</div>
                </div>
                <div className="lp-stat-cell__src">{cell.source}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Article body + TOC */}
      <section className="bg-[#ECE4D2] py-20 md:py-24">
        <div className="lp-container">
          <div className="grid grid-cols-12 gap-8 lg:gap-12">
            <aside className="hidden xl:block col-span-3">
              <div className="sticky top-28">
                <div className="lp-toc">
                  <div className="lp-toc__title">Contents</div>
                  <TocItem id="intro" num="·" label="Introduction" current={currentId} />
                  {body.chapters.map((c) => (
                    <TocItem key={c.id} id={c.id} num={c.num} label={c.shortTitle} current={currentId} />
                  ))}
                  <TocItem id="sources" num="·" label="Sources" current={currentId} />
                </div>
              </div>
            </aside>

            <article className="col-span-12 xl:col-span-9 lp-prose">
              <section id="intro">
                <div className="lp-eyebrow text-[#1F8282] mb-3">Introduction</div>
                {body.introContent}
              </section>

              {body.chapters.map((c) => (
                <section key={c.id} id={c.id} className="lp-chapter">
                  <div className="lp-chapter__num">Chapter {c.num}</div>
                  <h2>{c.title}</h2>
                  {c.content}
                </section>
              ))}
            </article>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-[#213F4F] text-white py-20 md:py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(212,160,36,0.08), transparent 60%)' }}
        />
        <div className="lp-container relative z-10 text-center max-w-3xl mx-auto">
          <div className="lp-eyebrow text-[#D4A024] mb-5">Why we built this</div>
          <h2
            className="font-heading font-bold leading-[1.15]"
            style={{ fontSize: 'clamp(26px, 3.4vw, 42px)', letterSpacing: '-0.015em' }}
          >
            We built Cairnly for the people inside <br className="hidden md:block" />these numbers.
          </h2>
          <p className="mt-7 text-base md:text-lg text-white/65 font-medium leading-relaxed">
            One assessment, built with career coaches, that turns who you actually are into specific
            roles you could go land. So one of those 90,000 hours, at least, gets spent right.
          </p>
          <div className="mt-10">
            <Link to="/payment" className="lp-btn-primary inline-flex" style={{ fontSize: 17 }}>
              Take the assessment
              <ArrowRight size={18} strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </section>

      {/* Sources + Methodology */}
      <section id="sources" className="bg-[#FAF5E8] py-20 md:py-24 scroll-mt-32">
        <div className="lp-container max-w-4xl">
          <div className="lp-eyebrow text-[#1F8282] mb-5">Sources cited</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-10"
            style={{ fontSize: 'clamp(24px, 2.8vw, 36px)', letterSpacing: '-0.012em' }}
          >
            What this report draws from.
          </h2>
          <ol className="lp-sources list-none p-0 m-0">
            {body.sources.map((s) => (
              <li key={s.n}>{s.content}</li>
            ))}
          </ol>

          <div
            className="mt-10 p-6 rounded-2xl"
            style={{ background: 'rgba(212,160,36,0.08)', border: '1px solid rgba(212,160,36,0.25)' }}
          >
            <div className="lp-eyebrow text-[#D4A024] mb-3">Methodology</div>
            <p className="text-[14.5px] text-[#4B6373] font-medium leading-relaxed">{body.methodology}</p>
          </div>
        </div>
      </section>

      <LandingFooter />

      {/* JSON-LD schema for SEO / LLM citing */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
    </div>
  );
};

export default JournalArticle;
