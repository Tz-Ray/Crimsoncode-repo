export type Task = {
  id: string;
  title: string;
  description?: string;
  date: string;        // YYYY-MM-DD
  time?: string;       // HH:mm
  completed: boolean;
  priority?: 1 | 2 | 3;
};