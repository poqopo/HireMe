"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  ArrowDownToLine,
  Check,
  Loader2,
  MessageSquare,
  Settings2,
  Workflow,
  X,
} from "lucide-react";
import type { Agent } from "@/lib/demo";
import { AgentIcon } from "./agent-icon";

type FlowData = {
  agent?: Agent;
  label?: string;
  state?: string;
  selected?: boolean;
  locked?: boolean;
  onRemove?: (id: string) => void;
  onInspect?: (agent: Agent) => void;
  [key: string]: unknown;
};
type FlowNode = Node<FlowData>;

function AgentNode({ data }: NodeProps<FlowNode>) {
  const agent = data.agent!;
  return (
    <div
      className={`flow-agent ${data.state ?? "idle"} ${data.selected ? "selected" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-top">
        <AgentIcon agent={agent} />
        <span className="node-tools">
          <button
            className="nodrag"
            aria-label={`${agent.name} 정보`}
            onClick={() => data.onInspect?.(agent)}
          >
            <Settings2 size={13} />
          </button>
          <button
            className="nodrag"
            aria-label={`${agent.name} 제거`}
            disabled={data.locked}
            onClick={() => data.onRemove?.(agent.id)}
          >
            <X size={13} />
          </button>
        </span>
      </div>
      <strong>{agent.name}</strong>
      <span className="node-role">{agent.role}</span>
      <div className="node-footer">
        <span>{agent.price ? `${agent.price} USDC` : "Free"}</span>
        <span className={`node-status ${data.state}`}>
          {data.state === "running" ? (
            <>
              <Loader2 size={11} className="spin" /> 실행 중
            </>
          ) : data.state === "done" ? (
            <>
              <Check size={11} /> 완료
            </>
          ) : (
            <>
              <span className="status-dot" /> 준비됨
            </>
          )}
        </span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function EndpointNode({ data, id }: NodeProps<FlowNode>) {
  return (
    <div className="endpoint-node">
      {id === "input" ? (
        <>
          <MessageSquare size={19} />
          <Handle type="source" position={Position.Right} />
        </>
      ) : (
        <>
          <ArrowDownToLine size={19} />
          <Handle type="target" position={Position.Left} />
        </>
      )}
      <span>{data.label}</span>
    </div>
  );
}

const nodeTypes = { agent: AgentNode, endpoint: EndpointNode };

function workflowNodes(
  selected: Agent[],
  active: string | null,
  completed: string[],
  selectedNodeId: string | null,
  running: boolean,
  onRemove: (id: string) => void,
  onInspect: (agent: Agent) => void,
): FlowNode[] {
  return [
    {
      id: "input",
      type: "endpoint",
      position: { x: 0, y: 72 },
      data: { label: "질문" },
      draggable: false,
      selectable: false,
    },
    ...selected.map((agent, index) => ({
      id: agent.id,
      type: "agent",
      position: { x: 110 + index * 220, y: 26 },
      draggable: false,
      data: {
        agent,
        state:
          agent.id === active
            ? "running"
            : completed.includes(agent.id)
              ? "done"
              : "idle",
        selected: agent.id === selectedNodeId,
        locked: running,
        onRemove,
        onInspect,
      },
    })),
    {
      id: "output",
      type: "endpoint",
      position: { x: 110 + selected.length * 220, y: 72 },
      data: { label: "결과" },
      draggable: false,
      selectable: false,
    },
  ];
}

function workflowEdges(selected: Agent[]): Edge[] {
  const ids = ["input", ...selected.map((agent) => agent.id), "output"];
  return ids.slice(1).map((target, index) => ({
    id: `${ids[index]}-${target}`,
    source: ids[index],
    target,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#94a3b8", strokeWidth: 1.5 },
  }));
}

export default function FlowCanvas({
  selected,
  active,
  completed,
  running,
  selectedNodeId,
  onRemove,
  onInspect,
  onSelectNode,
}: {
  selected: Agent[];
  active: string | null;
  completed: string[];
  running: boolean;
  selectedNodeId: string | null;
  onRemove: (id: string) => void;
  onInspect: (agent: Agent) => void;
  onSelectNode: (id: string) => void;
}) {
  const [flow, setFlow] = useState<{
    fitView: (options?: { padding?: number; duration?: number }) => void;
  } | null>(null);
  const nodes = useMemo(
    () =>
      workflowNodes(
        selected,
        active,
        completed,
        selectedNodeId,
        running,
        onRemove,
        onInspect,
      ),
    [selected, active, completed, selectedNodeId, running, onRemove, onInspect],
  );
  const edges = useMemo(() => workflowEdges(selected), [selected]);

  useEffect(() => {
    if (!flow) return;
    const timer = setTimeout(
      () => flow.fitView({ padding: 0.08, duration: 180 }),
      50,
    );
    return () => clearTimeout(timer);
  }, [flow, selected]);

  return (
    <section className="canvas-section">
      <div className="section-heading">
        <div>
          <Workflow size={16} />
          <strong>에이전트 워크플로</strong>
          <span className="count-badge">{selected.length}</span>
        </div>
        <span className="workflow-hint">노드를 클릭해 결과 보기</span>
      </div>
      <div className="flow-stage">
        <ReactFlow
          nodes={nodes}
          edges={edges.map((edge) => ({ ...edge, animated: running }))}
          nodeTypes={nodeTypes}
          onInit={setFlow}
          onNodeClick={(_, node) => {
            onSelectNode(node.id);
          }}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={0.15}
          maxZoom={1.4}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          edgesFocusable={false}
          aria-label="에이전트 워크플로"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={17}
            size={1}
            color="#dce2eb"
          />
        </ReactFlow>
      </div>
      <div className="canvas-caption">
        <span>
          <span className="status-dot" />{" "}
          {running
            ? "에이전트 팀이 작업하고 있어요"
            : "노드를 클릭하면 해당 에이전트의 결과를 확인할 수 있어요"}
        </span>
        <span>순서대로 실행</span>
      </div>
    </section>
  );
}
