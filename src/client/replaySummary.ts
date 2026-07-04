export type ReplaySummaryInput = {
  status: string;
  completedSeasonCount: number;
  requiredSeasonCount: number;
  summary: {
    totalPicks: number;
    roi: number;
    winRate: number;
  };
};

export function replayStatusDetail(report: ReplaySummaryInput | null): string {
  if (!report) {
    return "Checking cached historical replay.";
  }

  return `${report.summary.totalPicks.toLocaleString()} scored picks, ${formatPct(report.summary.roi)} ROI, ${formatPct(report.summary.winRate)} win rate`;
}

export function replayStatusLabel(report: ReplaySummaryInput | null): string {
  if (!report) {
    return "checking";
  }

  if (report.status === "verified") {
    return "verified";
  }

  if (report.summary.totalPicks > 0) {
    return "cached";
  }

  return report.status;
}

function formatPct(value: number): string {
  return `${(Math.round(value * 1000) / 10).toFixed(1)}%`;
}
