import type { Metadata } from "next";
import { LegalDoc, LegalSection } from "@/components/legal-doc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Swiper collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="9 September 2026">
      <LegalSection title="1. Scope">
        <p>
          This Privacy Policy explains what personal data Swiper collects
          through its mobile app, website, and related services, why we
          collect it, and how it is protected. It applies to both customers
          and providers. Where Malaysian law applies, this policy is
          intended to align with the Personal Data Protection Act 2010
          (PDPA).
        </p>
        <p>
          The data controller responsible for this processing is{" "}
          <strong className="font-semibold text-ink">Swiper Resources</strong>{" "}
          (Reg. No. 202603157950 / AS0516780-V), of No. 26, Jalan Utama 39,
          Rini Residence, Mutiara Rini, 81300 Skudai, Johor, Malaysia.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>
          <strong className="font-semibold text-ink">Account information:</strong>{" "}
          name, phone number, email address, date of birth, and gender,
          collected when you register and verified where noted (phone
          numbers are verified with a one-time code before an account is
          activated).
        </p>
        <p>
          <strong className="font-semibold text-ink">Location:</strong> your
          device&rsquo;s precise or approximate location, used to show nearby
          providers, set a service address, and calculate service radius.
          Location access can be controlled from your device settings.
        </p>
        <p>
          <strong className="font-semibold text-ink">Photos and identity documents:</strong>{" "}
          a profile photo, and — for providers — government identity
          document images (IC or passport) submitted for verification, plus
          photos of completed work and certificates. Identity documents are
          stored in a private, access-controlled location and are only
          viewable by the provider themselves and Swiper&rsquo;s admin team
          during review.
        </p>
        <p>
          <strong className="font-semibold text-ink">Payment information:</strong>{" "}
          the amount, method, and — for cash payments — a photo of the
          proof-of-payment slip submitted to confirm a payment. Swiper does
          not collect or store full payment card numbers.
        </p>
        <p>
          <strong className="font-semibold text-ink">Booking and communication data:</strong>{" "}
          details of the services you request or provide, booking status
          history, and messages exchanged between a customer and provider
          about a specific booking.
        </p>
        <p>
          <strong className="font-semibold text-ink">Device and notification data:</strong>{" "}
          a device token used to deliver push notifications about booking
          updates, and standard technical data such as app version and
          device type for troubleshooting.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use your information">
        <p>
          We use the information above to operate the marketplace: matching
          bookings, verifying provider identity before a profile goes live,
          processing payments, sending booking and account notifications,
          enabling reviews, responding to support requests, and keeping the
          platform secure — including detecting fraud and enforcing these
          Terms.
        </p>
      </LegalSection>

      <LegalSection title="4. Who we share it with">
        <p>
          We use trusted service providers to operate Swiper, who process
          data on our behalf under contractual confidentiality obligations:
          a database and file-storage provider (Supabase) that hosts account
          data, booking data, and uploaded documents/images; and a push
          notification provider (Firebase) used to deliver app
          notifications. If SMS delivery for verification codes is enabled,
          an SMS delivery provider processes the phone number and code for
          that single purpose.
        </p>
        <p>
          We do not sell your personal data. We may disclose information if
          required by law, to protect the safety of our users, or in
          connection with an investigation of suspected fraud or misuse of
          the platform.
        </p>
      </LegalSection>

      <LegalSection title="5. Identity documents specifically">
        <p>
          Government ID images submitted for provider verification are used
          solely to confirm a provider&rsquo;s identity before approval and
          are stored separately from public profile data, in private
          storage that is never publicly accessible. Access is limited to
          the submitting provider and authorised Swiper administrators
          performing the review.
        </p>
      </LegalSection>

      <LegalSection title="6. Data retention">
        <p>
          We retain account and booking data for as long as your account is
          active and for a reasonable period afterward to meet legal,
          accounting, and dispute-resolution obligations. You may request
          deletion of your account as described below.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>
          Subject to applicable law, you may request access to, correction
          of, or deletion of your personal data, and may withdraw consent to
          non-essential processing. Many of these can be done directly in
          the app under your profile settings; for anything else, contact us
          using the details below.
        </p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          We use industry-standard safeguards to protect your data,
          including encrypted connections, access-controlled storage for
          sensitive documents, and server-side validation of the sensitive
          actions in the app (such as identity verification and role
          permissions). No system is completely secure, and we continuously
          work to improve these protections.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>
          Swiper is not directed at children, and accounts may only be
          created by individuals who are legally capable of entering into a
          binding contract under Malaysian law.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. Material
          changes will be reflected by an updated &ldquo;Last updated&rdquo;
          date on this page.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          For privacy questions or data requests, contact{" "}
          <a href="mailto:privacy@myswiper.my" className="text-primary underline underline-offset-2">
            privacy@myswiper.my
          </a>
          .
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
