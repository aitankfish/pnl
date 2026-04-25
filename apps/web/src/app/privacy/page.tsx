'use client';

import EditorialDoc from '@/components/EditorialDoc';

export default function PrivacyPolicy() {
  return (
    <EditorialDoc
      eyebrow="Promise"
      title="Privacy policy"
      subtitle="What we collect, what we don't, and how the grove keeps your data."
      lastUpdated="December 2024"
    >
      <section>
        <h2>§ 01 — Introduction</h2>
        <p>
          PNL (Predict &amp; Launch), a service provided by WOLP LLC, respects your
          privacy and is committed to protecting your personal data. This privacy
          policy explains how we collect, use, and safeguard your information when
          you use our platform.
        </p>
      </section>

      <section>
        <h2>§ 02 — Information we collect</h2>
        <p>We may collect the following types of information:</p>
        <ul>
          <li>
            <strong>Wallet address.</strong> Your public Solana wallet address used
            for transactions.
          </li>
          <li>
            <strong>Profile information.</strong> Username, profile photo, and bio
            you choose to provide.
          </li>
          <li>
            <strong>Email address.</strong> If you sign up using email or social
            login.
          </li>
          <li>
            <strong>Transaction data.</strong> Records of your market participation
            and votes.
          </li>
          <li>
            <strong>Usage data.</strong> How you interact with our platform.
          </li>
        </ul>
      </section>

      <section>
        <h2>§ 03 — How we use your information</h2>
        <ul>
          <li>To provide and maintain our prediction market services.</li>
          <li>To process your transactions and market participation.</li>
          <li>To communicate with you about your account and platform updates.</li>
          <li>To improve our platform and user experience.</li>
          <li>To detect and prevent fraud or abuse.</li>
        </ul>
      </section>

      <section>
        <h2>§ 04 — Blockchain data</h2>
        <p>
          Please note that blockchain transactions are public by nature. Your
          wallet address and transaction history on the Solana blockchain are
          publicly visible and cannot be deleted or modified. We have no control
          over this public blockchain data.
        </p>
      </section>

      <section>
        <h2>§ 05 — Data storage</h2>
        <p>
          Your off-chain data (profile information, preferences) is stored
          securely in our databases. We use industry-standard security measures to
          protect your information. Profile images may be stored on IPFS
          (InterPlanetary File System).
        </p>
      </section>

      <section>
        <h2>§ 06 — Third-party services</h2>
        <p>We use the following third-party services:</p>
        <ul>
          <li>
            <strong>Privy.</strong> For authentication and wallet management.
          </li>
          <li>
            <strong>Solana.</strong> For blockchain transactions.
          </li>
          <li>
            <strong>Helius.</strong> For blockchain data indexing.
          </li>
          <li>
            <strong>IPFS / Pinata.</strong> For decentralized file storage.
          </li>
        </ul>
        <p>
          These services have their own privacy policies governing their use of
          your data.
        </p>
      </section>

      <section>
        <h2>§ 07 — Cookies and tracking</h2>
        <p>
          We use essential cookies to maintain your session and preferences. We do
          not use tracking cookies for advertising purposes.
        </p>
      </section>

      <section>
        <h2>§ 08 — Data sharing</h2>
        <p>
          We do not sell your personal information. We may share data with service
          providers who assist in operating our platform, or when required by law.
        </p>
      </section>

      <section>
        <h2>§ 09 — Your rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your off-chain profile data.</li>
          <li>Withdraw consent for data processing.</li>
        </ul>
        <p>
          <em>Note:</em> on-chain data cannot be modified or deleted due to the
          nature of blockchain technology.
        </p>
      </section>

      <section>
        <h2>§ 10 — Security</h2>
        <p>
          We implement appropriate technical and organizational measures to
          protect your data. However, no method of transmission over the Internet
          is 100% secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <h2>§ 11 — Children's privacy</h2>
        <p>
          PNL is not intended for users under 18 years of age. We do not knowingly
          collect personal information from children.
        </p>
      </section>

      <section>
        <h2>§ 12 — Changes to this policy</h2>
        <p>
          We may update this privacy policy from time to time. We will notify you
          of any changes by posting the new policy on this page and updating the
          "Last updated" date.
        </p>
      </section>

      <section>
        <h2>§ 13 — Contact us</h2>
        <p>
          If you have questions about this Privacy Policy or wish to exercise your
          data rights, please reach out via our community Discord or X.
        </p>
      </section>
    </EditorialDoc>
  );
}
