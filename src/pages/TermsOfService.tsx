
import React from 'react';
import Navbar from '@/components/Navbar';
import LandingFooter from '@/components/landing/LandingFooter';

const TermsOfService = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gray-50">
        <div className="container-atlas py-16">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
            <div className="text-sm text-gray-600 mb-8">
              <p>Last updated: July 3, 2025</p>
            </div>

            <div className="prose max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
                <p className="text-gray-700 mb-4">
                  By accessing and using the Cairnly platform operated by Cairnly ("we," "our," or "us"), you accept and agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our services.
                </p>
                <p className="text-gray-700">
                  These Terms apply to all visitors, users, and others who access or use our career assessment services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
                <p className="text-gray-700 mb-4">
                  Cairnly provides AI-enhanced career assessment services designed to deliver personalized career clarity through interactive chat-based evaluations. Our services include:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Comprehensive career assessments and personality evaluations</li>
                  <li>Personalized career clarity reports and recommendations</li>
                  <li>AI-enhanced analysis of career preferences and skills</li>
                  <li>Secure data storage and user account management</li>
                  <li>LinkedIn integration for enhanced profile analysis (optional)</li>
                </ul>
                <p className="text-gray-700">
                  Our platform is currently in Beta phase, and we continuously improve our services based on user feedback and technological advances.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts and Registration</h2>
                <p className="text-gray-700 mb-4">
                  To access our services, you must create an account by providing accurate and complete information. You are responsible for:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Maintaining the confidentiality of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Notifying us immediately of any unauthorized use</li>
                  <li>Providing accurate and up-to-date information</li>
                </ul>
                <p className="text-gray-700">
                  You must be at least 18 years old to use our services. By creating an account, you represent that you meet this age requirement.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Access Codes and Payment</h2>
                <h3 className="text-xl font-medium text-gray-900 mb-3">4.1 Access Codes</h3>
                <p className="text-gray-700 mb-4">
                  Access to our assessment services requires a valid access code, which can be obtained through:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Direct purchase through our platform</li>
                  <li>Third-party providers or partners</li>
                  <li>Promotional offers or beta access programs</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-900 mb-3">4.2 Payment Terms</h3>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>All fees are non-refundable unless otherwise stated</li>
                  <li>Prices are subject to change with notice</li>
                  <li>Payment processing is handled by secure third-party providers</li>
                  <li>Access codes have expiration dates as specified at purchase</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-900 mb-3">4.3 Refund Policy</h3>
                <p className="text-gray-700">
                  Due to the nature of our digital assessment services, all sales are final. Refunds may be considered on a case-by-case basis for technical issues that prevent service delivery, subject to our discretion and investigation.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Acceptable Use</h2>
                <p className="text-gray-700 mb-4">You agree not to:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>Use the service for any unlawful purpose or in violation of applicable laws</li>
                  <li>Share access codes with unauthorized individuals</li>
                  <li>Attempt to reverse engineer, hack, or compromise our platform</li>
                  <li>Upload malicious content or attempt to disrupt our services</li>
                  <li>Impersonate others or provide false information</li>
                  <li>Use automated scripts or bots to access our services</li>
                  <li>Violate the intellectual property rights of Cairnly or third parties</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Intellectual Property Rights</h2>
                <p className="text-gray-700 mb-4">
                  The Cairnly platform, including all content, features, functionality, and technology, is owned by Cairnly and is protected by copyright, trademark, and other intellectual property laws.
                </p>
                <h3 className="text-xl font-medium text-gray-900 mb-3">6.1 Your Content</h3>
                <p className="text-gray-700 mb-4">
                  You retain ownership of information you provide during assessments. However, you grant us a limited license to use this information to:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Provide and improve our assessment services</li>
                  <li>Generate your personalized reports</li>
                  <li>Enhance our AI algorithms (in anonymized form)</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-900 mb-3">6.2 Assessment Reports</h3>
                <p className="text-gray-700">
                  The assessment reports generated for you are for your personal use. You may not redistribute, sell, or commercially exploit these reports without our written consent.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Privacy and Data Protection</h2>
                <p className="text-gray-700 mb-4">
                  Your privacy is important to us. Our collection, use, and protection of your personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.
                </p>
                <p className="text-gray-700">
                  By using our services, you consent to the collection and use of your information as described in our Privacy Policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Disclaimers and Limitations</h2>
                <h3 className="text-xl font-medium text-gray-900 mb-3">8.1 Service Disclaimers</h3>
                <p className="text-gray-700 mb-4">
                  Cairnly provides career guidance and insights based on assessment responses. Our services are:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>For informational and guidance purposes only</li>
                  <li>Not a substitute for professional career counseling</li>
                  <li>Not guaranteed to result in specific career outcomes</li>
                  <li>Based on AI analysis that may have limitations</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-900 mb-3">8.2 Beta Service Notice</h3>
                <p className="text-gray-700 mb-4">
                  Our platform is currently in Beta. This means:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Services may be modified or discontinued</li>
                  <li>Features may not be fully developed</li>
                  <li>Occasional downtime or technical issues may occur</li>
                  <li>Data backup and recovery procedures are in place but not guaranteed</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-900 mb-3">8.3 Limitation of Liability</h3>
                <p className="text-gray-700">
                  To the maximum extent permitted by law, Cairnly shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities, arising from your use of our services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Third-Party Integrations</h2>
                <p className="text-gray-700 mb-4">
                  Our platform may integrate with third-party services such as LinkedIn. These integrations are subject to the terms and privacy policies of the respective third parties. We are not responsible for the practices or content of these third-party services.
                </p>
                <p className="text-gray-700">
                  You may disconnect third-party integrations at any time through your profile settings.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Termination</h2>
                <p className="text-gray-700 mb-4">
                  We may terminate or suspend your account and access to our services at our sole discretion, without prior notice, for conduct that we believe:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Violates these Terms of Service</li>
                  <li>Is harmful to other users or our business</li>
                  <li>Violates applicable laws or regulations</li>
                </ul>
                <p className="text-gray-700">
                  You may terminate your account at any time by contacting us. Upon termination, your right to use the service will cease immediately.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Governing Law and Dispute Resolution</h2>
                <p className="text-gray-700 mb-4">
                  These Terms shall be governed by and construed in accordance with the laws of the Netherlands, without regard to conflict of law principles.
                </p>
                <p className="text-gray-700 mb-4">
                  Any disputes arising from these Terms or your use of our services shall be resolved through binding arbitration in accordance with the rules of the Netherlands Arbitration Institute, except that you may assert claims in small claims court if they qualify.
                </p>
                <p className="text-gray-700">
                  The arbitration will be conducted in English in Utrecht, Netherlands, unless otherwise agreed by the parties.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibent text-gray-900 mb-4">12. Changes to Terms</h2>
                <p className="text-gray-700 mb-4">
                  We reserve the right to modify these Terms at any time. We will notify users of material changes by:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Posting the updated Terms on our website</li>
                  <li>Updating the "Last updated" date</li>
                  <li>Sending email notifications for significant changes</li>
                </ul>
                <p className="text-gray-700">
                  Your continued use of our services after changes become effective constitutes acceptance of the revised Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Severability</h2>
                <p className="text-gray-700">
                  If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will remain in full force and effect. The invalid provision will be replaced with a valid provision that most closely reflects the intent of the original provision.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Entire Agreement</h2>
                <p className="text-gray-700">
                  These Terms, together with our Privacy Policy, constitute the entire agreement between you and Cairnly regarding the use of our services and supersede all prior agreements and understandings.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Contact Information</h2>
                <p className="text-gray-700 mb-4">
                  If you have any questions about these Terms of Service, please contact us:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700"><strong>Email:</strong> legal@cairnly.io</p>
                  <p className="text-gray-700"><strong>Support:</strong> info@cairnly.io</p>
                  <p className="text-gray-700"><strong>Address:</strong> Cairnly, Utrecht, The Netherlands</p>
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

export default TermsOfService;
