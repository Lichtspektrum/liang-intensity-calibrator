export interface ScoreData {
  score: number;
  stage: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positivePoints: number;
  negativePoints: number;
  isColdStart: boolean;
  recentEvents: TimelineEventData[];
}

export interface TimelineEventData {
  id: number;
  date: string;
  title: string;
  summary: string | null;
  isMajor: boolean;
}

export interface VoteResult {
  accepted: boolean;
  reason?: string;
  userPosition: number;
  score: number;
  stage: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positivePoints: number;
  negativePoints: number;
}

export interface TimelineDayData {
  date: string;
  score: number;
  stage: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  events: TimelineEventData[];
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function submitVote(
  fingerprint: string,
  position: number,
): Promise<VoteResult> {
  return fetchJson<VoteResult>("/api/vote", {
    method: "POST",
    body: JSON.stringify({ fingerprint, position }),
  });
}

export async function fetchTimeline(from?: string, to?: string): Promise<TimelineDayData[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString() ? `?${params}` : "";
  return fetchJson<TimelineDayData[]>(`/api/timeline${query}`);
}

export async function fetchTimelineDay(date: string): Promise<TimelineDayData> {
  return fetchJson<TimelineDayData>(`/api/timeline/${date}`);
}
