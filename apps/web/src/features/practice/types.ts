export interface ScenarioSummary {
  id: string;
  scenario_key: string;
  title: string;
  domain: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  based_on: string | null;
  estimated_minutes: number;
  tags: string[];
  version: number;
  is_active: boolean;
}

export interface ScenarioListResponse {
  scenarios: ScenarioSummary[];
  total: number;
}

export interface SessionNodeChoice {
  id: string;
  text: string;
}

export interface SessionNodeState {
  node_id: string;
  text: string;
  player_input: boolean;
  input_type: string | null;
  choices: SessionNodeChoice[];
}

export interface SessionOut {
  id: string;
  scenario_key: string;
  scenario_title: string;
  domain: string;
  status: "active" | "completed" | "abandoned";
  score: number;
  max_score: number;
  decisions_count: number;
  correct_count: number;
  started_at: string;
  completed_at: string | null;
  generated_facts: Record<string, any>;
  current_node: SessionNodeState | null;
}

export interface DecisionResponse {
  choice_id: string;
  is_correct: boolean;
  score_awarded: number;
  feedback: string;
  citation: string | null;
  issue_tag: string | null;
  next_node: SessionNodeState | null;
}

export interface DebriefDecision {
  node_id: string;
  choice_id: string;
  choice_text: string;
  is_correct: boolean;
  score_awarded: number;
  feedback: string;
  citation: string | null;
  issue_tag: string | null;
  input_value: any | null;
  time_taken_ms: number | null;
}

export interface DebriefResponse {
  session_id: string;
  scenario_title: string;
  domain: string;
  score: number;
  max_score: number;
  decisions_count: number;
  correct_count: number;
  started_at: string;
  completed_at: string | null;
  decisions: [] | DebriefDecision[];
}

export interface BlindSpotDetail {
  issue_tag: string;
  domain: string;
  attempts: number;
  correct: number;
  accuracy: number;
  streak: number;
  last_attempted: string;
}

export interface PracticeProfileResponse {
  blind_spots: BlindSpotDetail[];
  strengths: BlindSpotDetail[];
}

export interface SessionHistoryItem {
  id: string;
  scenario_title: string;
  domain: string;
  difficulty: string;
  score: number;
  max_score: number;
  status: string;
  completed_at: string | null;
}
