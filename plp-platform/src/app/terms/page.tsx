'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-black text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-400 mb-8">Last updated: December 2024</p>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using P&L (Predict & Launch), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              P&L is a prediction market platform built on Solana that enables community-driven project
              validation and fundraising. Users can participate in prediction markets by staking SOL to
              vote on project viability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Eligibility</h2>
            <p>
              You must be at least 18 years old to use P&L. By using our platform, you represent and
              warrant that you meet this age requirement and have the legal capacity to enter into
              these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. User Responsibilities</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You are responsible for maintaining the security of your wallet and credentials</li>
              <li>You agree not to use the platform for any illegal or unauthorized purpose</li>
              <li>You will not attempt to manipulate markets or engage in fraudulent activity</li>
              <li>You understand that cryptocurrency transactions are irreversible</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Risks</h2>
            <p className="mb-3">
              By using P&L, you acknowledge and accept the following risks:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Cryptocurrency values are volatile and you may lose your entire investment</li>
              <li>Prediction markets involve speculation and outcomes are uncertain</li>
              <li>Smart contracts may contain bugs or vulnerabilities</li>
              <li>Blockchain transactions are final and cannot be reversed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Fees</h2>
            <p>
              P&L charges the following fees: a market creation fee of 0.015 SOL, a 1.5% fee on trades,
              and a 5% completion fee when markets resolve. These fees are subject to change with notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Intellectual Property</h2>
            <p>
              All content, features, and functionality of P&L are owned by us and are protected by
              international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Disclaimer of Warranties</h2>
            <p>
              P&L is provided "as is" without warranties of any kind. We do not guarantee that the
              platform will be error-free, secure, or continuously available.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, P&L and its team shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including loss of
              profits, data, or other intangible losses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the platform
              after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Contact</h2>
            <p>
              For questions about these Terms of Service, please contact us through our official
              social media channels or community Discord.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center text-gray-500 text-sm">
          <p>P&L - Predict & Launch</p>
        </div>
      </div>
    </div>
  );
}
