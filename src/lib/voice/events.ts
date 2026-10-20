export type LiveEvent = {
  type: string;
  delta?: string;
  start_ms?: number;
  end_ms?: number;
  error?: { message?: string };
  usage?: { seconds?: number };
  finalized?: boolean;
  [key: string]: unknown;
};