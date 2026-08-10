import { demoAgents } from "@/data/demoAgents";
import { supabase } from "@/lib/supabase";
import type { DesignAgent } from "@/types";

export async function listDesignAgents(): Promise<DesignAgent[]> {
  if (!supabase) return demoAgents;
  const { data, error } = await supabase
    .from("agents")
    .select("id, slug, name, headline, public_summary, public_skills, result_types, cover_image_url, pricing, profiles!agents_creator_id_fkey(display_name)")
    .eq("category", "design")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      creatorName: profile?.display_name || "HireMe Designer",
      headline: row.headline,
      summary: row.public_summary,
      skills: row.public_skills || [],
      resultTypes: row.result_types || [],
      coverImageUrl: row.cover_image_url,
      pricing: (row.pricing || {}) as DesignAgent["pricing"],
    };
  });
}

export function rankAgents(agents: DesignAgent[], request: string) {
  const terms = request.toLowerCase().split(/[^a-z0-9가-힣]+/).filter((term) => term.length > 1);
  return [...agents].sort((left, right) => score(right) - score(left));
  function score(agent: DesignAgent) {
    const profile = [agent.name, agent.headline, agent.summary, ...agent.skills, ...agent.resultTypes].join(" ").toLowerCase();
    return terms.reduce((total, term) => total + (profile.includes(term) ? 1 : 0), 0);
  }
}
