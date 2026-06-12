import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert } from "lucide-react";

/**
 * Single Legal page hosting Terms, Privacy, Refund Policy, and Responsible
 * Gambling sections. Linked from the footer and routed at /legal,
 * /terms, /privacy, /refunds (all render this page, scrolled to a section).
 */
export default function LegalPage() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    const map: Record<string, string> = {
      "/terms": "terms",
      "/privacy": "privacy",
      "/refunds": "refunds",
      "/responsible-gambling": "responsible",
    };
    const id = map[location];
    if (id) {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location]);

  const updated = "June 2, 2026";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border">
        <div className="container py-4 flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" /> Home
          </Button>
          <span className="font-semibold">MLB Edge — Legal & Policies</span>
        </div>
      </div>

      <div className="container max-w-3xl py-10 space-y-12 leading-relaxed">
        {/* Disclaimer banner */}
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200/90">
            <strong>Entertainment only.</strong> MLB Edge provides statistical analysis and
            informational content. It is not betting advice, financial advice, or a guarantee of any
            outcome. Sports betting involves risk. You are solely responsible for your decisions and
            for complying with the laws of your jurisdiction. Must be 21+ (or legal age where you
            live). If gambling is a problem, call <strong>1-800-GAMBLER</strong>.
          </p>
        </div>

        <nav className="text-sm text-muted-foreground flex flex-wrap gap-x-6 gap-y-2">
          <a href="#terms" className="hover:text-foreground">Terms of Service</a>
          <a href="#privacy" className="hover:text-foreground">Privacy Policy</a>
          <a href="#refunds" className="hover:text-foreground">Refund Policy</a>
          <a href="#responsible" className="hover:text-foreground">Responsible Gambling</a>
        </nav>

        {/* TERMS */}
        <section id="terms" className="space-y-3 scroll-mt-20">
          <h2 className="text-2xl font-bold">Terms of Service</h2>
          <p className="text-xs text-muted-foreground">Last updated: {updated}</p>
          <p className="text-sm text-muted-foreground">
            By accessing or using MLB Edge ("the Service"), you agree to these Terms. If you do not
            agree, do not use the Service.
          </p>
          <h3 className="font-semibold pt-2">1. Eligibility</h3>
          <p className="text-sm text-muted-foreground">
            You must be at least 21 years old (or the legal gambling age in your jurisdiction,
            whichever is higher) to use the Service. You are responsible for ensuring that your use
            of sports-betting information is legal where you live.
          </p>
          <h3 className="font-semibold pt-2">2. Nature of the Service</h3>
          <p className="text-sm text-muted-foreground">
            MLB Edge provides data-driven statistical models, projections, odds comparisons, and
            informational content about Major League Baseball. All content is provided for
            informational and entertainment purposes only. We do not accept, place, or facilitate
            wagers, and we are not a sportsbook. Past performance and model "win rates" are
            historical or backtested figures and do not guarantee future results.
          </p>
          <h3 className="font-semibold pt-2">3. No Guarantees</h3>
          <p className="text-sm text-muted-foreground">
            We make no representation that any pick, projection, or strategy will be profitable. You
            assume all risk for any decisions you make based on the Service.
          </p>
          <h3 className="font-semibold pt-2">4. Subscriptions & Billing</h3>
          <p className="text-sm text-muted-foreground">
            Paid plans are billed on a recurring basis (monthly or annual) through our payment
            processor, Stripe. Billing begins immediately upon subscribing at the listed rate. You
            may cancel at any time from the Billing page; cancellation stops future renewals.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Founding Member rate lock:</strong> The first 500 paying members receive a
            “Founding Member” rate for their tier. That rate will not increase for as long as the
            subscription remains continuously active. If a Founding Member cancels and later
            resubscribes, current standard pricing applies.
          </p>
          <h3 className="font-semibold pt-2">5. Acceptable Use</h3>
          <p className="text-sm text-muted-foreground">
            You may not resell, redistribute, scrape, or republish our content or picks without
            written permission. We may suspend accounts that abuse the Service.
          </p>
          <h3 className="font-semibold pt-2">6. Limitation of Liability</h3>
          <p className="text-sm text-muted-foreground">
            To the maximum extent permitted by law, MLB Edge and its operators are not liable for
            any gambling losses, lost profits, or indirect, incidental, or consequential damages
            arising from your use of the Service.
          </p>
          <h3 className="font-semibold pt-2">7. Changes</h3>
          <p className="text-sm text-muted-foreground">
            We may update these Terms from time to time. Continued use after changes constitutes
            acceptance.
          </p>
        </section>

        {/* PRIVACY */}
        <section id="privacy" className="space-y-3 scroll-mt-20">
          <h2 className="text-2xl font-bold">Privacy Policy</h2>
          <p className="text-xs text-muted-foreground">Last updated: {updated}</p>
          <p className="text-sm text-muted-foreground">
            We respect your privacy and collect only what we need to run the Service.
          </p>
          <h3 className="font-semibold pt-2">What we collect</h3>
          <p className="text-sm text-muted-foreground">
            Account information (name, email) provided via sign-in; subscription and payment status
            (processed and stored by Stripe — we never see or store full card numbers); and basic
            usage analytics to improve the product.
          </p>
          <h3 className="font-semibold pt-2">How we use it</h3>
          <p className="text-sm text-muted-foreground">
            To authenticate you, provide and improve the Service, process subscriptions, and send
            service-related communications. We do not sell your personal data.
          </p>
          <h3 className="font-semibold pt-2">Third parties</h3>
          <p className="text-sm text-muted-foreground">
            We use Stripe for payments and standard analytics providers. Each processes data under
            its own privacy policy.
          </p>
          <h3 className="font-semibold pt-2">Your rights</h3>
          <p className="text-sm text-muted-foreground">
            You may request access to or deletion of your personal data by contacting support.
            Depending on your location (e.g., California/EU), you may have additional rights under
            CCPA/GDPR.
          </p>
        </section>

        {/* REFUNDS */}
        <section id="refunds" className="space-y-3 scroll-mt-20">
          <h2 className="text-2xl font-bold">Refund Policy</h2>
          <p className="text-xs text-muted-foreground">Last updated: {updated}</p>
          <p className="text-sm text-muted-foreground">
            Because MLB Edge delivers digital information that is consumed immediately, subscription
            fees are generally <strong>non-refundable</strong>. However:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>
              <strong>Cancel anytime:</strong> There are no long-term contracts. You can cancel
              before your next renewal to avoid further charges.
            </li>
            <li>
              <strong>Cancellations:</strong> You can cancel anytime from the Billing page. You keep
              access through the end of the period you already paid for; we do not pro-rate partial
              periods.
            </li>
            <li>
              <strong>Billing errors / duplicate charges:</strong> Contact support and we will
              investigate and refund any genuine error.
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            We do not offer refunds based on betting losses or dissatisfaction with pick outcomes —
            all content is informational and outcomes are never guaranteed.
          </p>
        </section>

        {/* RESPONSIBLE GAMBLING */}
        <section id="responsible" className="space-y-3 scroll-mt-20">
          <h2 className="text-2xl font-bold">Responsible Gambling</h2>
          <p className="text-sm text-muted-foreground">
            Betting should be fun, not a way to make money or escape problems. Only wager what you
            can afford to lose, set limits, and never chase losses.
          </p>
          <p className="text-sm text-muted-foreground">
            If you or someone you know may have a gambling problem, free, confidential help is
            available 24/7:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>National Problem Gambling Helpline: <strong>1-800-GAMBLER</strong> (1-800-426-2537)</li>
            <li>Text: <strong>800GAM</strong> to 53342</li>
            <li>Online: ncpgambling.org</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            You must be 21+ (or legal age in your jurisdiction) to use MLB Edge.
          </p>
        </section>

        <div className="pt-6 border-t border-border">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
