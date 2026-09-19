import {
  Search,
  Braces,
  PenLine,
  Code2,
  ChartNoAxesCombined,
  Languages,
} from "lucide-react";
import type { Agent } from "@/lib/demo";
const icons = {
  search: Search,
  structure: Braces,
  write: PenLine,
  code: Code2,
  chart: ChartNoAxesCombined,
  translate: Languages,
};
export function AgentIcon({
  agent,
  small = false,
}: {
  agent: Agent;
  small?: boolean;
}) {
  const Icon = icons[agent.icon];
  return (
    <span className={`agent-icon ${agent.color} ${small ? "small" : ""}`}>
      <Icon size={small ? 16 : 20} strokeWidth={1.8} />
    </span>
  );
}
