import { apiClient } from "@/shared/lib/api/client";
import type { LawyerDashboard } from "../types";

export const getLawyerDashboard = () =>
  apiClient.get<LawyerDashboard>("/docket/lawyer/dashboard");
