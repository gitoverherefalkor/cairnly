import React from 'react';
import Navbar from '@/components/Navbar';
import LandingFooter from '@/components/landing/LandingFooter';

const Security = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gray-50">
        <div className="container-atlas py-16">
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8 md:p-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">How we handle your data</h1>
            <p className="text-sm text-gray-400 mb-10">Plain English, not a legal wall.</p>

            <div className="space-y-10 text-gray-700 leading-relaxed">

              <section>
                <p>
                  Cairnly is built by a small team in the Netherlands. We take the privacy of your career and personality data seriously, because what you share with us is genuinely personal.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-3">What you tell us</h2>
                <p>
                  Your survey responses, optional resume, and chat conversation with your assessment coach. That's it. We don't ask for things we don't need.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-3">Where it lives</h2>
                <p>
                  Your survey answers, chat, and reports are stored on encrypted servers in Europe, hosted by Supabase, encrypted in transit and at rest. To generate your assessment and power the coaching chat, that data is processed by Anthropic and Google's business AI APIs. Neither trains its models on your data, under their commercial terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-3">Who can see it</h2>
                <p>
                  Only you, in your account. Nobody else gets a copy. We don't share aggregated insights with employers, recruiters, or anyone else. We don't sell our user list. We don't run ads.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-3">How long we keep it</h2>
                <p>
                  Your report, its scores, and the highlights from your coaching chat are kept for as long as your account exists. Your raw survey answers and the chat conversation itself are automatically deleted 30 days after you finish your coaching session. After that, at most some anonymized, aggregate statistics may remain (never anything traceable back to you). Delete your account at any time from your profile settings, and everything, reports included, is permanently removed within 24 hours. We don't keep "backup copies for our records."
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-3">Payments</h2>
                <p>
                  Processed by Stripe. We never see your card. Stripe is one of the most trusted names in online payments and handles billions in transactions every year.
                </p>
              </section>

              <section className="border-t border-gray-100 pt-8">
                <h2 className="text-xl font-bold text-gray-900 mb-3">Questions or concerns?</h2>
                <p>
                  Email us at{' '}
                  <a href="mailto:hello@cairnly.io" className="text-[#27A1A1] underline hover:text-[#27A1A1]/80">
                    hello@cairnly.io
                  </a>
                  . A real person will reply.
                </p>
              </section>

            </div>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
};

export default Security;
