export type Task = {
  id: string;
  title: string;
  description: string; // description of task by user
  date: string;       // "YYYY-MM-DD"
  time?: string;      // "HH:mm" optional
  completed: boolean;
};