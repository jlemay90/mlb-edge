declare module "lucide-react" {
  import type { ComponentType, SVGProps } from "react";

  export type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

  export const Activity: LucideIcon;
  export const BarChart3: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const Gauge: LucideIcon;
  export const HeartPulse: LucideIcon;
  export const LineChart: LucideIcon;
  export const ListChecks: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Table2: LucideIcon;
  export const TrendingUp: LucideIcon;
}
