'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
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

        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-400 mb-8">Last updated: December 2024</p>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              PNL (Predict & Launch), a service provided by WOLP LLC, respects your privacy and is committed to protecting your personal
              data. This privacy policy explains how we collect, use, and safeguard your information
              when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">We may collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Wallet Address:</strong> Your public Solana wallet address used for transactions</li>
              <li><strong>Profile Information:</strong> Username, profile photo, and bio you choose to provide</li>
              <li><strong>Email Address:</strong> If you sign up using email or social login</li>
              <li><strong>Transaction Data:</strong> Records of your market participation and votes</li>
              <li><strong>Usage Data:</strong> How you interact with our platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide and maintain our prediction market services</li>
              <li>To process your transactions and market participation</li>
              <li>To communicate with you about your account and platform updates</li>
              <li>To improve our platform and user experience</li>
              <li>To detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Blockchain Data</h2>
            <p>
              Please note that blockchain transactions are public by nature. Your wallet address and
              transaction history on the Solana blockchain are publicly visible and cannot be deleted
              or modified. We have no control over this public blockchain data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Storage</h2>
            <p>
              Your off-chain data (profile information, preferences) is stored securely in our databases.
              We use industry-standard security measures to protect your information. Profile images
              may be stored on IPFS (InterPlanetary File System).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Third-Party Services</h2>
            <p className="mb-3">We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Privy:</strong> For authentication and wallet management</li>
              <li><strong>Solana:</strong> For blockchain transactions</li>
              <li><strong>Helius:</strong> For blockchain data indexing</li>
              <li><strong>IPFS/Pinata:</strong> For decentralized file storage</li>
            </ul>
            <p className="mt-3">
              These services have their own privacy policies governing their use of your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Cookies and Tracking</h2>
            <p>
              We use essential cookies to maintain your session and preferences. We do not use
              tracking cookies for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Data Sharing</h2>
            <p>
              We do not sell your personal information. We may share data with service providers
              who assist in operating our platform, or when required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your off-chain profile data</li>
              <li>Withdraw consent for data processing</li>
            </ul>
            <p className="mt-3">
              Note: On-chain data cannot be modified or deleted due to the nature of blockchain technology.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your data.
              However, no method of transmission over the Internet is 100% secure, and we cannot
              guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Children's Privacy</h2>
            <p>
              PNL is not intended for users under 18 years of age. We do not knowingly collect
              personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of any changes
              by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your data rights,
              please contact us through our official social media channels or community Discord.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center text-gray-500 text-sm">
          <p>PNL - Predict & Launch</p>
          <p className="mt-1">A service provided by WOLP LLC</p>
        </div>
      </div>
    </div>
  );
}
