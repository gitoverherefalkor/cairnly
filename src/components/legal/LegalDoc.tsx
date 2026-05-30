import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Navbar from '@/components/Navbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { getLegalDoc, type LegalSlug } from '@/content/legal';

interface LegalDocProps {
  slug: LegalSlug;
}

/**
 * Shared layout for legal documents. Renders the markdown for the active
 * language (falling back to English) inside the standard nav + footer chrome.
 * Content comes from src/content/legal/<slug>.<lang>.md.
 */
const LegalDoc: React.FC<LegalDocProps> = ({ slug }) => {
  const { i18n } = useTranslation();
  const markdown = getLegalDoc(slug, i18n.language || 'en');

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gray-50">
        <div className="container-atlas py-16">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
            <article
              className="prose prose-slate max-w-none
                prose-headings:font-bold prose-headings:text-gray-900
                prose-h1:text-4xl prose-h1:mb-8
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
                prose-p:text-gray-700 prose-li:text-gray-700
                prose-a:text-atlas-teal hover:prose-a:underline"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </article>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
};

export default LegalDoc;
