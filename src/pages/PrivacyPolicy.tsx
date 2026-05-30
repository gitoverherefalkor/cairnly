
import React from 'react';
import Navbar from '@/components/Navbar';
import LandingFooter from '@/components/landing/LandingFooter';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gray-50">
        <div className="container-atlas py-16">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
            <div className="text-sm text-gray-600 mb-8">
              <p>Last updated: April 2, 2026</p>
            </div>

            <div className="prose max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
                <p className="text-gray-700 mb-4">
                  Cairnly ("we," "our," or "us") operates the Cairnly platform. This Privacy Policy explains how we collect, use, process, and protect your personal information when you use our career assessment services.
                </p>
                <p className="text-gray-700">
                  By using our services, you agree to the collection and use of information in accordance with this Privacy Policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
                
                <h3 className="text-xl font-medium text-gray-900 mb-3">2.1 Personal Information</h3>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Name, email address, and contact information</li>
                  <li>Professional information (job title, company, industry)</li>
                  <li>Demographics (age range, location, pronouns)</li>
                  <li>LinkedIn profile data (when you connect your LinkedIn account)</li>
                  <li>Resume and CV information</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-900 mb-3">2.2 Assessment Data</h3>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Responses to assessment questions</li>
                  <li>Career preferences and goals</li>
                  <li>Skills and competency assessments</li>
                  <li>Personality and behavioral insights</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-900 mb-3">2.3 Technical Information</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>IP address and device information</li>
                  <li>Browser type and version</li>
                  <li>Usage analytics and interaction data</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information and Legal Basis</h2>
                <p className="text-gray-700 mb-4">Under the GDPR (Article 6), we process your data based on the following legal grounds:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li><strong>Contract performance:</strong> Provide personalized career assessment and recommendations, generate career reports, and process payments</li>
                  <li><strong>Contract performance:</strong> Communicate with you about your assessment results and provide customer support</li>
                  <li><strong>Legitimate interest:</strong> Improve our assessment methodology and platform reliability</li>
                  <li><strong>Legal obligation:</strong> Comply with applicable laws and protect our rights</li>
                  <li><strong>Consent:</strong> Send marketing communications and optional reminder emails (you can opt out at any time via your profile settings)</li>
                  <li><strong>Consent (Journal newsletter):</strong> If you subscribe to the Cairnly Journal, we store your email address solely to send three to four issues per year. We use a confirmed double opt-in and include a one-click unsubscribe link in every email.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. LinkedIn Integration</h2>
                <p className="text-gray-700 mb-4">
                  When you choose to connect your LinkedIn account, we access limited profile information to enhance your assessment experience:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Basic profile information (name, email, current position)</li>
                  <li>Professional experience and education history</li>
                  <li>Skills and endorsements</li>
                </ul>
                <p className="text-gray-700">
                  This integration is optional and you can disconnect it at any time from your profile settings.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Sharing and Disclosure</h2>
                <p className="text-gray-700 mb-4">We do not sell your personal information. We share data with the following processors to operate our platform:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li><strong>Supabase Inc.</strong> (EU/US) — Database hosting, authentication, and file storage</li>
                  <li><strong>n8n GmbH</strong> (Germany) — AI-powered assessment analysis and career report generation</li>
                  <li><strong>Google LLC</strong> (US, EU Data Processing Framework) — Resume text extraction via Gemini AI</li>
                  <li><strong>Stripe Inc.</strong> (US, EU Data Processing Framework) — Payment processing</li>
                  <li><strong>Resend Inc.</strong> (US) — Transactional email delivery</li>
                  <li><strong>Vercel Inc.</strong> (US) — Website hosting and delivery</li>
                </ul>
                <p className="text-gray-700 mt-4">We may also share information when:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                  <li><strong>Business Transfers:</strong> In case of merger, acquisition, or sale of assets</li>
                  <li><strong>Consent:</strong> With your explicit permission for other purposes</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Security</h2>
                <p className="text-gray-700 mb-4">
                  We implement industry-standard security measures to protect your personal information:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Secure authentication and access controls</li>
                  <li>Regular security assessments and updates</li>
                  <li>Limited access to personal information on a need-to-know basis</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights (GDPR)</h2>
                <p className="text-gray-700 mb-4">Under the GDPR, you have the following rights:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li><strong>Access:</strong> Download a copy of your personal data from your Profile settings</li>
                  <li><strong>Rectification:</strong> Update your information via your Profile settings</li>
                  <li><strong>Erasure:</strong> Permanently delete your account and all data from your Profile settings</li>
                  <li><strong>Portability:</strong> Export your data in machine-readable format (JSON) from your Profile settings</li>
                  <li><strong>Restriction:</strong> Request limitation of processing by contacting us</li>
                  <li><strong>Objection:</strong> Object to processing by contacting us</li>
                  <li><strong>Withdraw Consent:</strong> Withdraw consent at any time (e.g. disable email reminders in your Profile)</li>
                </ul>
                <p className="text-gray-700 mt-4">
                  You can exercise your rights to access, export, and delete directly from your <strong>Profile Settings</strong> page. For other requests, contact us at privacy@cairnly.io.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">7a. Automated Decision-Making</h2>
                <p className="text-gray-700 mb-4">
                  Our platform uses AI to analyze your assessment responses and generate personalized career recommendations. This involves automated profiling of your personality traits, skills, and career preferences.
                </p>
                <p className="text-gray-700 mb-4">
                  <strong>Important:</strong> These AI-generated recommendations are advisory only and do not constitute binding decisions about your career, employment, or any other matter. You are free to follow, modify, or disregard any recommendation.
                </p>
                <p className="text-gray-700">
                  Under GDPR Article 22, you have the right to request human review of any automated assessment. Contact us at privacy@cairnly.io if you wish to exercise this right.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Data Retention</h2>
                <p className="text-gray-700">
                  We retain your personal information for up to 3 years after your last login, or for the duration of your account, whichever is longer. You can delete your account and all associated data at any time from your Profile settings. After account deletion, all personal data is permanently removed within 30 days.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cookies and Tracking</h2>
                <p className="text-gray-700 mb-4">
                  We use only essential cookies required for platform functionality (authentication). We do not use analytics, tracking, or advertising cookies. See our <a href="/cookie-policy" className="text-blue-600 hover:underline">Cookie Policy</a> for details.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. International Data Transfers</h2>
                <p className="text-gray-700 mb-4">
                  Some of our service providers process data outside the EU/EEA:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li><strong>n8n GmbH</strong> — Germany (EU, no transfer needed)</li>
                  <li><strong>Supabase Inc.</strong> — EU region selected for database hosting</li>
                  <li><strong>Google LLC, Stripe Inc.</strong> — US, covered by the EU-US Data Privacy Framework</li>
                  <li><strong>Resend Inc., Vercel Inc.</strong> — US, covered by Standard Contractual Clauses</li>
                </ul>
                <p className="text-gray-700 mt-4">
                  We ensure appropriate safeguards are in place for all international transfers in accordance with GDPR Chapter V.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to This Privacy Policy</h2>
                <p className="text-gray-700">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
                <p className="text-gray-700 mb-4">
                  If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700"><strong>Email:</strong> privacy@cairnly.io</p>
                  <p className="text-gray-700"><strong>Address:</strong> Cairnly, Utrecht, The Netherlands</p>
                  <p className="text-gray-700"><strong>Data Protection Officer:</strong> dpo@cairnly.io</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
};

export default PrivacyPolicy;
