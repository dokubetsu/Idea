import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api/client";
import { FEATURES_DEFAULT } from "@/shared/config/features";

export interface FeatureFlags {
  consultations: boolean;
  billing: boolean;
  hearings: boolean;
  milestones: boolean;
  ai_summaries: boolean;
  practice: boolean;
}

export function useFeatures() {
  const { data, isLoading } = useQuery<FeatureFlags>({
    queryKey: ["features"],
    queryFn: async () => {
      try {
        return await apiClient.get<FeatureFlags>("/system/features");
      } catch {
        return FEATURES_DEFAULT;
      }
    },
    staleTime: Infinity, // Static configuration cache
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  return {
    features: data ?? FEATURES_DEFAULT,
    isLoading,
  };
}
