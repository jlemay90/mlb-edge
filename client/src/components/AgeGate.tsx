import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "mlbedge_age_ok";

/**
 * One-time 21+ confirmation gate. Required for marketing betting-related
 * content (Facebook/Google policy) and good legal hygiene. Stores acceptance
 * in localStorage so it only shows once per device.
 */
export function AgeGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const accept = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const deny = () => {
    window.location.href = "https://www.ncpgambling.org/";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <h2 className="text-2xl font-bold text-foreground">Are you 21 or older?</h2>
        <p className="text-sm text-muted-foreground mt-3">
          MLB Edge provides sports-betting analysis for entertainment purposes. You must be 21+ (or
          the legal age in your jurisdiction) to enter. This is not betting or financial advice.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button className="w-full" onClick={accept}>
            Yes, I am 21 or older
          </Button>
          <Button variant="outline" className="w-full" onClick={deny}>
            No / Exit
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-4">
          Gambling problem? Call 1-800-GAMBLER.
        </p>
      </div>
    </div>
  );
}
