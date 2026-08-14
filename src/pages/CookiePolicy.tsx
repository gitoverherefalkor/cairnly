import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CookiePolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" onClick={() => navigate('/')} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-[#27A1A1] mb-2">Cookie Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: August 14, 2026</p>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">What Are Cookies?</h2>
            <p className="text-gray-600 leading-relaxed">
              Cookies are small text files stored on your device when you visit a website. They help the website
              remember your preferences and keep you logged in. We aim to use as few cookies as possible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies We Use</h2>

            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-1">Essential Cookies (Required)</h3>
                <p className="text-sm text-gray-600 mb-2">
                  These cookies are necessary for the platform to function. They cannot be disabled.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-gray-700">Cookie</th>
                      <th className="text-left py-2 pr-4 font-medium text-gray-700">Purpose</th>
                      <th className="text-left py-2 font-medium text-gray-700">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono text-xs">sb-*-auth-token</td>
                      <td className="py-2 pr-4">Keeps you logged in (Supabase authentication)</td>
                      <td className="py-2">Session / 1 year</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono text-xs">cairnly-cookie-consent</td>
                      <td className="py-2 pr-4">Remembers your cookie preference</td>
                      <td className="py-2">Persistent</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-1">Third-Party Cookies</h3>
                <p className="text-sm text-gray-600 mb-2">
                  When you make a payment, Stripe may set temporary cookies during the checkout process.
                  These are only active during the payment flow and are governed by{' '}
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-atlas-blue underline">
                    Stripe's Privacy Policy
                  </a>.
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-1">Advertising Cookies (Optional)</h3>
                <p className="text-sm text-gray-600 mb-2">
                  These are only set if you click "Accept All" on the cookie banner. If you choose
                  "Essential Only," Google measures ad performance in a privacy-preserving, cookieless
                  way instead, without setting these cookies.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-gray-700">Cookie</th>
                      <th className="text-left py-2 pr-4 font-medium text-gray-700">Purpose</th>
                      <th className="text-left py-2 font-medium text-gray-700">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr>
                      <td className="py-2 pr-4 font-mono text-xs">_gcl_au</td>
                      <td className="py-2 pr-4">
                        Google Ads conversion measurement — links an ad click to a later purchase, so
                        we can tell whether our ad campaigns are working
                      </td>
                      <td className="py-2">90 days</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-sm text-gray-600 mt-2">
                  For confirmed purchases, we may also share a hashed (SHA-256) version of your email
                  address with Google for conversion matching ("enhanced conversions"). Google cannot
                  read the email address itself. See our{' '}
                  <a href="/privacy-policy" className="text-atlas-blue underline">Privacy Policy</a>{' '}
                  for details.
                </p>
              </div>

              <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                <h3 className="font-medium text-green-800 mb-1">No Other Tracking</h3>
                <p className="text-sm text-green-700">
                  Beyond the essential and Google Ads cookies above, we do not use any other analytics
                  or tracking cookies, and we do not share cookie data with any other advertisers.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Local Storage</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              In addition to cookies, we use your browser's local storage for:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm">
              <li>Your cookie consent preference</li>
              <li>Chat session identifiers (for AI career chat continuity)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Managing Cookies</h2>
            <p className="text-gray-600 leading-relaxed">
              You can clear cookies at any time through your browser settings. Note that clearing
              essential cookies will sign you out. You can also change your cookie preference by
              clearing your browser's local storage for this site, which will show the consent
              banner again on your next visit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have questions about our use of cookies, contact us at{' '}
              <a href="mailto:privacy@cairnly.io" className="text-atlas-blue underline">
                privacy@cairnly.io
              </a>.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              For more on how your data is stored and protected, see our{' '}
              <a href="/security" className="text-atlas-blue underline">Security page</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;
