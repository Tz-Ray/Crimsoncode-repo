export type Task = {
  id: string;
  title: string;
  description?: string;
  date: string;        // YYYY-MM-DD
  time?: string;       // HH:mm
  completed: boolean;
  priority?: 1 | 2 | 3;

  // Optional metadata for AI-generated tasks / plans
  aiGenerated?: boolean;
  planId?: string;
};

export type PlanDraftTask = {
  title: string;
  description?: string;
  date: string;       // YYYY-MM-DD
  time?: string;      // HH:mm
  priority?: 1 | 2 | 3;
};

export type PlanRequest = {
  goalTitle: string;
  goalDetails?: string;
  startDate: string;
  endDate: string;
  constraints?: string;
};