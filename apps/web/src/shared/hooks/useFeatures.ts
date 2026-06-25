import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api/client";
import { FEATURES_DEFAULT } from "@/shared/config/features";

export interface FeatureFlags {
  consultations: boolean;
  billing: boolean;
  hearings: boolean;
  milestones: boolean;
  ai_summaries: boolean;
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
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  return {
    features: data ?? FEATURES_DEFAULT,
    isLoading,
  };
}
