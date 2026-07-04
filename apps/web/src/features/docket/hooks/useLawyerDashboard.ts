import { useQuery } from "@tanstack/react-query";
import { getLawyerDashboard } from "../api/lawyer-dashboard";

export const docketKeys = {
  lawyerDashboard: () => ["docket", "lawyer-dashboard"] as const,
  clientDashboard: () => ["docket", "client-dashboard"] as const,
  overview: (id: string) => ["docket", id, "overview"] as const,
  billing: (id: string) => ["docket", id, "billing"] as const,
  timeEntries: (id: string) => ["docket", id, "time-entries"] as const,
  invoices: (id: string) => ["docket", id, "invoices"] as const,
  tasks: (id: string) => ["docket", id, "tasks"] as const,
  timeline: (id: string) => ["docket", id, "timeline"] as const,
  notes: (id: string) => ["docket", id, "notes"] as const,
  feeArrangement: (id: string) => ["docket", id, "fee-arrangement"] as const,
};

export function useLawyerDashboard() {
  return useQuery({
    queryKey: docketKeys.lawyerDashboard(),
    queryFn: getLawyerDashboard,
  });
}
