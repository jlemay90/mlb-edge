import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPORTSBOOKS } from "../../../shared/sportsbooks";

interface SportsbookLinksProps {
  /** Optional label above the buttons. Defaults to "Bet this pick at:" */
  label?: string;
  /** Show only these sportsbook IDs (defaults to all) */
  show?: string[];
  /** Compact mode: smaller buttons, no label */
  compact?: boolean;
  /** Extra class names on the wrapper */
  className?: string;
}

export function SportsbookLinks({
  label = "Bet this pick at:",
  show,
  compact = false,
  className = "",
}: SportsbookLinksProps) {
  const books = show
    ? SPORTSBOOKS.filter((s) => show.includes(s.id))
    : SPORTSBOOKS;

  if (books.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {!compact && (
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </p>
      )}
      <div className={`flex flex-wrap gap-2 ${compact ? "" : ""}`}>
        {books.map((book) => (
          <a
            key={book.id}
            href={book.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-90 ${book.bgColor} ${book.borderColor} ${book.logoColor}`}
            title={`Open ${book.name}`}
          >
            {book.shortName}
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        ))}
      </div>
      {!compact && (
        <p className="text-[10px] text-muted-foreground/60">
          Affiliate links — we may earn a commission at no extra cost to you. 21+. Gamble responsibly.
        </p>
      )}
    </div>
  );
}

/** Minimal inline version for pick cards */
export function SportsbookBadges({ className = "" }: { className?: string }) {
  return (
    <SportsbookLinks
      compact
      show={["draftkings", "fanduel"]}
      className={className}
    />
  );
}
