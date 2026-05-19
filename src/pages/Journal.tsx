import React from 'react';
import '../components/landing/landing.css';
import { Clock, Calendar, FileText, ArrowRight } from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import { featuredArticle, otherArticles, type JournalArticle } from '@/content/journal';

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const FeaturedCard: React.FC<{ article: JournalArticle }> = ({ article }) => (
  // Rendered as a static card until the /journal/:slug article page ships.
  <div className="lp-featured-card grid md:grid-cols-12 gap-0">
    {/* Left visual */}
    <div
      className="md:col-span-5 relative overflow-hidden p-10 md:p-12"
      style={{ background: '#213F4F', color: '#fff', minHeight: 380 }}
    >
      <div
        className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'rgba(212,160,36,0.20)', filter: 'blur(80px)', marginRight: -150, marginTop: -150 }}
      />
      <div className="relative z-10 h-full flex flex-col">
        <div className="lp-eyebrow text-[#D4A024] mb-6">{article.reportLabel || 'Cairnly Research'}</div>
        <div className="mt-auto">
          {article.featuredStatNumber && (
            <div
              className="font-heading font-bold text-white"
              style={{ fontSize: 80, lineHeight: 1, letterSpacing: '-0.03em' }}
            >
              {article.featuredStatNumber.replace('%', '')}
              {article.featuredStatNumber.includes('%') && <span className="text-[#D4A024]">%</span>}
            </div>
          )}
          {article.featuredStatCaption && (
            <p className="mt-5 text-base text-white/75 font-medium leading-snug max-w-xs">
              {article.featuredStatCaption}
            </p>
          )}
          {article.featuredStatSource && (
            <p className="mt-4 text-[11px] text-white/40 font-medium italic">{article.featuredStatSource}</p>
          )}
        </div>
      </div>
    </div>

    {/* Right content */}
    <div className="md:col-span-7 p-10 md:p-12 flex flex-col">
      <div className="flex items-center gap-2 mb-5">
        {article.topics.map((topic, i) => (
          <span key={topic} className={`lp-topic-chip ${i === 0 ? 'lp-gold' : ''}`}>
            {topic}
          </span>
        ))}
      </div>

      <h2
        className="font-heading font-bold text-[#122E3B] leading-[1.1] mb-5"
        style={{ fontSize: 'clamp(28px, 3.4vw, 42px)', letterSpacing: '-0.018em' }}
      >
        {article.title}
      </h2>
      <p className="text-[17px] text-[#4B6373] font-medium leading-relaxed mb-7">{article.excerpt}</p>

      <div className="flex items-center gap-6 text-[12.5px] text-[#6B7F8B] font-medium mb-7 flex-wrap">
        {article.readingTime && (
          <span className="flex items-center gap-1.5">
            <Clock size={14} strokeWidth={1.8} />
            {article.readingTime} min read
          </span>
        )}
        {article.publishedAt && (
          <span className="flex items-center gap-1.5">
            <Calendar size={14} strokeWidth={1.8} />
            {formatDate(article.publishedAt)}
          </span>
        )}
        {article.sourceCount && (
          <span className="flex items-center gap-1.5">
            <FileText size={14} strokeWidth={1.8} />
            {article.sourceCount} sources
          </span>
        )}
      </div>

      <div
        className="mt-auto inline-flex items-center gap-2 font-heading font-bold text-[#1F8282]"
        style={{ fontSize: 14, letterSpacing: '0.05em', textTransform: 'uppercase' }}
      >
        Read the report
        <ArrowRight size={18} strokeWidth={2.4} />
      </div>
    </div>
  </div>
);

const Journal: React.FC = () => (
  <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: '#F4ECDA', color: '#122E3B' }}>
    <LandingNav variant="page" />

    {/* Hero */}
    <header className="bg-[#213F4F] text-white pt-14 md:pt-20 pb-16 md:pb-20 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{ background: 'rgba(39,161,161,0.12)', filter: 'blur(120px)', marginLeft: -300, marginTop: -300 }}
      />
      <div className="lp-container relative z-10">
        <div className="flex items-center gap-3 mb-8 text-[10px] font-heading font-bold tracking-[0.22em] uppercase text-[#D4A024]">
          <span>The Cairnly Journal</span>
          <span className="h-px w-12 bg-[#D4A024]/40" />
        </div>
        <h1 className="font-heading font-bold leading-[1.05]" style={{ fontSize: 'clamp(36px, 6vw, 76px)', letterSpacing: '-0.025em' }}>
          Notes, research, and reports{' '}
          <br />
          <span className="lp-text-gold-grad">on career fit.</span>
        </h1>
        <p className="mt-9 text-lg md:text-xl text-white/65 font-medium leading-relaxed max-w-2xl">
          What the data actually says about meaningful work, where coaching helps and where it
          doesn't, and the methodology behind how Cairnly thinks. Published when we have something
          worth saying.
        </p>
      </div>
    </header>

    {/* Featured */}
    {featuredArticle && (
      <section className="bg-[#FAF5E8] py-16 md:py-20">
        <div className="lp-container">
          <div className="flex items-center gap-3 mb-8">
            <div className="lp-eyebrow text-[#1F8282]">Featured · Latest</div>
            <span className="h-px flex-1 bg-[#C9B690]/40 max-w-[120px]" />
          </div>
          <FeaturedCard article={featuredArticle} />
        </div>
      </section>
    )}

    {/* More writing */}
    <section className="bg-[#ECE4D2] py-16 md:py-20">
      <div className="lp-container">
        <div className="flex items-center gap-3 mb-8">
          <div className="lp-eyebrow text-[#1F8282]">More writing</div>
          <span className="h-px flex-1 bg-[#C9B690]/40 max-w-[120px]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {otherArticles.map((article) => (
            <div key={article.slug} className="lp-coming-card p-7">
              <div className="flex items-center gap-2 mb-5">
                {article.topics.slice(0, 1).map((topic) => (
                  <span key={topic} className="lp-topic-chip">{topic}</span>
                ))}
              </div>
              <h3
                className="font-heading font-bold text-[#6B7F8B] leading-[1.2] mb-3"
                style={{ fontSize: 19, letterSpacing: '-0.012em' }}
              >
                {article.title}
              </h3>
              <p className="text-[14px] text-[#6B7F8B] font-medium leading-relaxed mb-6">
                {article.excerpt}
              </p>
              <div className="text-[11px] text-[#9CA3AF] font-medium italic">
                {article.status === 'coming-soon' ? 'Coming soon' : 'Published'}
                {article.category ? ` · ${article.category}` : ''}
              </div>
            </div>
          ))}
        </div>

        {/* Subscribe */}
        <div
          className="mt-14 max-w-2xl mx-auto text-center rounded-2xl p-8 md:p-10"
          style={{ background: '#FBF6E8', border: '1px solid rgba(212, 160, 36, 0.3)' }}
        >
          <div className="lp-eyebrow text-[#1F8282] mb-3">When the next one drops</div>
          <h3 className="font-heading font-bold text-[#122E3B] mb-3" style={{ fontSize: 22, letterSpacing: '-0.012em' }}>
            Get a note when we publish.
          </h3>
          <p className="text-[14px] text-[#4B6373] font-medium leading-relaxed mb-6">
            Three to four times a year. No marketing newsletter. Just a short email when a report or
            essay goes live.
          </p>
          <form
            className="flex flex-col sm:flex-row items-stretch gap-2 max-w-md mx-auto"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              required
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 rounded-full border text-[14px] font-medium"
              style={{ background: '#fff', borderColor: '#C9B690', color: '#122E3B' }}
            />
            <button type="submit" className="lp-btn-primary" style={{ padding: '12px 22px', fontSize: 14 }}>
              Subscribe
            </button>
          </form>
          <p className="text-[11px] text-[#9CA3AF] mt-4">No tracking pixels. Unsubscribe with one click.</p>
        </div>
      </div>
    </section>

    <LandingFooter />
  </div>
);

export default Journal;
