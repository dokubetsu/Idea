import { useQuery } from "@tanstack/react-query";
import { getClientDashboard } from "../api/client-dashboard";
import { docketKeys } from "./useLawyerDashboard";

export function useClientDashboard() {
  return useQuery({
    queryKey: docketKeys.clientDashboard(),
    queryFn: getClientDashboard,
  });
}
