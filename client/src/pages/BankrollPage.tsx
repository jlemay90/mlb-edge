/**
 * Bankroll Tracker — Syndicate-tier feature.
 * Log real bets, settle them, and see live record + ROI computed from real
 * American-odds payout math on the server. No fabricated data.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { RequireTier } from "@/components/RequireTier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Check,
  X,
  Trash2,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

type BetType = "moneyline" | "runline" | "total" | "prop" | "parlay" | "other";
type BetResult = "pending" | "win" | "loss" | "push" | "void";

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const RESULT_STYLE: Record<BetResult, string> = {
  pending: "bg-muted text-muted-foreground",
  win: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  loss: "bg-red-500/15 text-red-400 border-red-500/30",
  push: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  void: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

function AddBetForm({ onAdded }: { onAdded: () => void }) {
  const [description, setDescription] = useState("");
  const [betType, setBetType] = useState<BetType>("moneyline");
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("");

  const addMutation = trpc.bets.add.useMutation({
    onSuccess: () => {
      toast.success("Bet logged");
      setDescription("");
      setOdds("");
      setStake("");
      setBetType("moneyline");
      onAdded();
    },
    onError: (e) => toast.error(e.message || "Could not log bet"),
  });

  const submit = () => {
    const oddsNum = parseInt(odds, 10);
    const stakeNum = parseFloat(stake);
    if (!description.trim()) return toast.error("Add a description");
    if (!Number.isFinite(oddsNum) || oddsNum === 0)
      return toast.error("Enter valid American odds, e.g. -110 or 145");
    if (!Number.isFinite(stakeNum) || stakeNum <= 0)
      return toast.error("Enter a stake greater than 0");
    addMutation.mutate({
      description: description.trim(),
      betType,
      odds: oddsNum,
      stakeDollars: stakeNum,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Log a bet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              placeholder="e.g. Yankees ML vs Red Sox"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Bet type</Label>
            <Select value={betType} onValueChange={(v) => setBetType(v as BetType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moneyline">Moneyline</SelectItem>
                <SelectItem value="runline">Run line</SelectItem>
                <SelectItem value="total">Total (O/U)</SelectItem>
                <SelectItem value="prop">Prop</SelectItem>
                <SelectItem value="parlay">Parlay</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="odds">Odds (American)</Label>
              <Input
                id="odds"
                inputMode="numeric"
                placeholder="-110"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stake">Stake ($)</Label>
              <Input
                id="stake"
                inputMode="decimal"
                placeholder="25"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
              />
            </div>
          </div>
        </div>
        <Button onClick={submit} disabled={addMutation.isPending} className="gap-2">
          <Plus className="w-4 h-4" />
          {addMutation.isPending ? "Adding…" : "Add bet"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SummaryBar({ summary }: { summary: any }) {
  const profit = summary?.profitCents ?? 0;
  const positive = profit >= 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Record (W-L-P)</p>
          <p className="text-xl font-black text-foreground mt-1">
            {summary?.wins ?? 0}-{summary?.losses ?? 0}-{summary?.pushes ?? 0}
          </p>
          {summary?.winPct !== null && summary?.winPct !== undefined && (
            <p className="text-xs text-muted-foreground mt-0.5">{summary.winPct}% win</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Total staked</p>
          <p className="text-xl font-black text-foreground mt-1">{money(summary?.stakedCents ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{summary?.settledCount ?? 0} settled</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Net profit</p>
          <p className={cn("text-xl font-black mt-1", positive ? "text-emerald-400" : "text-red-400")}>
            {positive ? "+" : ""}
            {money(profit)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">returned {money(summary?.returnedCents ?? 0)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">ROI</p>
          <p
            className={cn(
              "text-xl font-black mt-1 flex items-center gap-1",
              (summary?.roiPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {summary?.roiPct === null || summary?.roiPct === undefined ? (
              "—"
            ) : (
              <>
                {(summary.roiPct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />)}
                {summary.roiPct >= 0 ? "+" : ""}
                {summary.roiPct}%
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">on settled stake</p>
        </CardContent>
      </Card>
    </div>
  );
}

function BankrollInner() {
  const utils = trpc.useUtils();
  const listQuery = trpc.bets.list.useQuery(undefined, { refetchOnWindowFocus: false });

  const settleMutation = trpc.bets.settle.useMutation({
    onSuccess: () => {
      utils.bets.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Could not settle bet"),
  });
  const removeMutation = trpc.bets.remove.useMutation({
    onSuccess: () => {
      toast.success("Bet removed");
      utils.bets.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Could not remove bet"),
  });

  const bets = listQuery.data?.bets ?? [];
  const summary = listQuery.data?.summary;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" /> Bankroll Tracker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Log your real bets and track ROI. Payouts are computed from true American-odds math.
        </p>
      </div>

      {listQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <SummaryBar summary={summary} />
      )}

      <AddBetForm onAdded={() => utils.bets.list.invalidate()} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your bets</CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : bets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No bets logged yet. Add your first bet above to start tracking.
            </p>
          ) : (
            <div className="space-y-2">
              {bets.map((b: any) => {
                const oddsLabel = b.odds > 0 ? `+${b.odds}` : `${b.odds}`;
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{b.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.betType} · {oddsLabel} · {money(b.stakeCents)} stake
                        {b.result !== "pending" && b.payoutCents != null && (
                          <> · returned {money(b.payoutCents)}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={cn("capitalize", RESULT_STYLE[b.result as BetResult])}>
                        {b.result}
                      </Badge>
                      {b.result === "pending" ? (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 text-emerald-400"
                            title="Win"
                            onClick={() => settleMutation.mutate({ betId: b.id, result: "win" })}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 text-red-400"
                            title="Loss"
                            onClick={() => settleMutation.mutate({ betId: b.id, result: "loss" })}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 text-amber-400"
                            title="Push"
                            onClick={() => settleMutation.mutate({ betId: b.id, result: "push" })}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 text-muted-foreground"
                          title="Remove"
                          onClick={() => removeMutation.mutate({ betId: b.id })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BankrollPage() {
  return (
    <RequireTier tier="syndicate" featureName="Bankroll Tracker">
      <BankrollInner />
    </RequireTier>
  );
}
