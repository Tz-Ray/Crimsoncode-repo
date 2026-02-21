export type Task = {
  id: string;
  title: string;
  date: string;       // "YYYY-MM-DD"
  time?: string;      // "HH:mm" optional
  completed: boolean;
};