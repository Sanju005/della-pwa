import type { Metadata } from "next";
import { LegalDoc, LegalSection } from "@/components/legal-doc";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that govern use of the Swiper platform.",
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms & Conditions" updated="9 September 2026">
      <LegalSection title="1. About Swiper">
        <p>
          Swiper (&ldquo;Swiper&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is operated by{" "}
          <strong className="font-semibold text-ink">Swiper Resources</strong>{" "}
          (Reg. No. 202603157950 / AS0516780-V), of No. 26, Jalan Utama 39,
          Rini Residence, Mutiara Rini, 81300 Skudai, Johor, Malaysia. Swiper
          operates a marketplace platform, available through our mobile app
          and website, that connects customers seeking home services with
          independent service providers offering chef, maid, tutor, driver,
          cleaner, babysitter, plumber, and electrician services across
          Malaysia. By creating an account or using the Swiper app, you agree
          to these Terms &amp; Conditions.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts and eligibility">
        <p>
          You must provide accurate information when registering, including a
          working phone number, which is verified by a one-time code before
          your account is activated. You must be legally capable of entering
          into a binding contract under Malaysian law to use Swiper.
        </p>
        <p>
          Providers additionally submit a government-issued identity document
          (IC or passport) as part of registration. Provider profiles are not
          made visible to customers until this identity verification has
          been reviewed and approved.
        </p>
      </LegalSection>

      <LegalSection title="3. Swiper is a marketplace, not an employer">
        <p>
          Providers on Swiper are independent, self-employed individuals, not
          employees, agents, or representatives of Swiper. Swiper does not
          supervise, direct, or control how a provider performs a service.
          The contract for the service itself is between the customer and
          the provider; Swiper&rsquo;s role is to facilitate discovery,
          booking, communication, and payment for that arrangement.
        </p>
      </LegalSection>

      <LegalSection title="4. Bookings">
        <p>
          A booking is created when a customer submits a request with a
          service, date, time, and price, calculated from the rate the
          provider has published for that service. A booking is only
          confirmed once the assigned provider accepts it; a provider may
          decline a request.
        </p>
        <p>
          Once accepted, a booking moves through a defined status flow
          (accepted, on the way, arrived, work finished, payment, completed)
          visible to both parties in the app. Either party may cancel a
          booking subject to any cancellation terms displayed in the app at
          the time of booking.
        </p>
      </LegalSection>

      <LegalSection title="5. Pricing and payment">
        <p>
          Hourly and daily rates are set by each provider for each service
          they offer and are shown to the customer before a booking is
          confirmed. The final amount for a completed job is confirmed in
          the app before payment is made.
        </p>
        <p>
          Swiper charges providers a commission on completed bookings, the
          terms of which are disclosed to providers in the app. Payment
          methods available to customers are shown at checkout and may
          change over time as Swiper adds new payment options.
        </p>
      </LegalSection>

      <LegalSection title="6. Reviews and conduct">
        <p>
          Customers may leave a rating and review after a booking is
          completed. Reviews must reflect a genuine, completed booking and
          must not contain abusive, defamatory, or unlawful content. Swiper
          may remove reviews or content that violate this policy.
        </p>
        <p>
          You agree not to use Swiper to harass, discriminate against, or
          endanger any other user, and not to attempt to circumvent Swiper&rsquo;s
          booking or payment systems to transact outside the platform.
        </p>
      </LegalSection>

      <LegalSection title="7. Account suspension and termination">
        <p>
          Swiper may suspend or terminate an account that violates these
          Terms, provides false verification information, or engages in
          conduct that puts other users at risk. You may stop using Swiper
          and request account closure at any time.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers and limitation of liability">
        <p>
          Swiper takes reasonable steps to verify provider identity but does
          not guarantee the quality, safety, or legality of services
          performed by providers, who remain independent contractors.
          Swiper&rsquo;s liability for any claim arising from use of the
          platform is limited to the maximum extent permitted under
          Malaysian law.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to these Terms">
        <p>
          We may update these Terms from time to time. Continued use of
          Swiper after an update constitutes acceptance of the revised
          Terms. Material changes will be reflected by an updated
          &ldquo;Last updated&rdquo; date on this page.
        </p>
      </LegalSection>

      <LegalSection title="10. Governing law">
        <p>
          These Terms are governed by the laws of Malaysia, without regard
          to conflict-of-law principles.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:legal@myswiper.my" className="text-primary underline underline-offset-2">
            legal@myswiper.my
          </a>
          .
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
