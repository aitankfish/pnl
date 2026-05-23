// ─────────────────────────────────────────────────────────────────
// HIDDEN ROUTE — content lives at docs.pnl.market/docs/legal/terms
// Registry: apps/web/HIDDEN_ROUTES.md
// To restore: delete `TermsOfService` stub, rename `TermsOriginal`
//             → `TermsOfService`. Untouch the rest.
// ─────────────────────────────────────────────────────────────────
'use client';

import { redirect } from 'next/navigation';
import EditorialDoc from '@/components/EditorialDoc';

export default function TermsOfService() {
  redirect('https://docs.pnl.market/docs/legal/terms');
  return null;
}

// ─── ORIGINAL COMPONENT — restore by renaming to TermsOfService ──
function TermsOriginal() {
  return (
    <EditorialDoc
      eyebrow="Promise"
      title="Terms of service"
      subtitle="The rules of the grove. By using PNL you agree to these."
      lastUpdated="December 2024"
    >
      <section>
        <h2>§ 01 — Acceptance of terms</h2>
        <p>
          By accessing or using PNL (Predict &amp; Launch), a service provided by
          WOLP LLC, you agree to be bound by these Terms of Service. If you do
          not agree to these terms, please do not use our platform.
        </p>
      </section>

      <section>
        <h2>§ 02 — Description of service</h2>
        <p>
          PNL is a prediction market platform built on Solana that enables
          community-driven project validation and fundraising. Users can
          participate in prediction markets by staking SOL to vote on project
          viability.
        </p>
      </section>

      <section>
        <h2>§ 03 — Eligibility</h2>
        <p>
          You must be at least 18 years old to use PNL. By using our platform,
          you represent and warrant that you meet this age requirement and have
          the legal capacity to enter into these terms.
        </p>
      </section>

      <section>
        <h2>§ 04 — User responsibilities</h2>
        <ul>
          <li>
            You are responsible for maintaining the security of your wallet and
            credentials.
          </li>
          <li>
            You agree not to use the platform for any illegal or unauthorized
            purpose.
          </li>
          <li>
            You will not attempt to manipulate markets or engage in fraudulent
            activity.
          </li>
          <li>You understand that cryptocurrency transactions are irreversible.</li>
        </ul>
      </section>

      <section>
        <h2>§ 05 — Risks</h2>
        <p>By using PNL, you acknowledge and accept the following risks:</p>
        <ul>
          <li>
            Cryptocurrency values are volatile and you may lose your entire
            investment.
          </li>
          <li>Prediction markets involve speculation and outcomes are uncertain.</li>
          <li>Smart contracts may contain bugs or vulnerabilities.</li>
          <li>Blockchain transactions are final and cannot be reversed.</li>
        </ul>
      </section>

      <section>
        <h2>§ 06 — Fees</h2>
        <p>
          PNL charges the following fees: a market creation fee of{' '}
          <strong>0.015 SOL</strong>, a <strong>1.5%</strong> fee on trades, and
          a <strong>5%</strong> completion fee when markets resolve. These fees
          are subject to change with notice.
        </p>
      </section>

      <section>
        <h2>§ 07 — Intellectual property</h2>
        <p>
          All content, features, and functionality of PNL are owned by us and
          are protected by international copyright, trademark, and other
          intellectual property laws.
        </p>
      </section>

      <section>
        <h2>§ 08 — Disclaimer of warranties</h2>
        <p>
          PNL is provided <em>"as is"</em> without warranties of any kind. We do
          not guarantee that the platform will be error-free, secure, or
          continuously available.
        </p>
      </section>

      <section>
        <h2>§ 09 — Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, WOLP LLC and its team shall
          not be liable for any indirect, incidental, special, consequential, or
          punitive damages, including loss of profits, data, or other intangible
          losses.
        </p>
      </section>

      <section>
        <h2>§ 10 — Changes to terms</h2>
        <p>
          We reserve the right to modify these terms at any time. Continued use
          of the platform after changes constitutes acceptance of the new terms.
        </p>
      </section>

      <section>
        <h2>§ 11 — Contact</h2>
        <p>
          For questions about these Terms of Service, please reach out via our
          community Discord or X.
        </p>
      </section>
    </EditorialDoc>
  );
}
