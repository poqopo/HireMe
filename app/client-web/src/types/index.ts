export type RequestStep = "request" | "match" | "brief" | "review" | "complete";

export type DesignAgent = {
  id: string;
  slug: string;
  name: string;
  creatorName: string;
  headline: string;
  summary: string;
  skills: string[];
  resultTypes: string[];
  coverImageUrl?: string | null;
  pricing: { mode?: string; amount?: number; currency?: string };
};

export type DesignRequest = {
  title: string;
  description: string;
  category: string;
  channel: string;
  deadline: string;
  budget: string;
  audience: string;
  guide: string;
  mustInclude: string;
  mustAvoid: string;
  files: File[];
};

export type SubmittedProject = { projectId: string; jobId: string; status: string };
