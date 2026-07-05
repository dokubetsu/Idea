import { apiClient } from "@/shared/lib/api/client";
import type { ClientDashboard } from "../types";

export const getClientDashboard = () =>
  apiClient.get<ClientDashboard>("/docket/client/dashboard");
