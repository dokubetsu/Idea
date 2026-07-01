export const FEATURES_DEFAULT = {
  billing: process.env.NEXT_PUBLIC_FEATURE_BILLING === "true", // default false
  hearings: process.env.NEXT_PUBLIC_FEATURE_HEARINGS === "true", // default false
  milestones: process.env.NEXT_PUBLIC_FEATURE_MILESTONES === "true", // default false
  ai_summaries: process.env.NEXT_PUBLIC_FEATURE_AI_SUMMARIES === "true", // default false
  consultations: process.env.NEXT_PUBLIC_FEATURE_CONSULTATIONS !== "false", // default true
  practice: process.env.NEXT_PUBLIC_FEATURE_PRACTICE !== "false", // default true
};
