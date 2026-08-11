import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
} from "@xyflow/react";
import { Check, ChevronLeft, ChevronRight, MessageSquare, Play, RefreshCw, RotateCcw, Save, ShieldCheck, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type StudioNodeData = {
  label: string;
  typeLabel: string;
  skillRef: string | null;
  status: string;
};

type AgentStudioProps = {
  agent: { id: string; name: string; headline: string };
  conversation: { id: string; messages: Array<{ id: string; role: "user" | "assistant"; text: string }> };
  managementSession: HireMeAgentManagementSession;
  workspace: string;
  runActive: boolean;
  onBack: () => void;
  onOpenChat: () => void;
  onCoachSend: (text: string) => void;
  onCancelRun: (runId: string) => void;
  onRevisionChange: (phase: string, revision: number) => void;
  onNotify: (title: string, detail?: string) => void;
};

const nodeTypes = { studioNode: StudioGraphNode };
const nodeTypeLabels: Record<string, string> = {
  intake: "Input",
  analyze: "Analyze",
  decide: "Decide",
  explore: "Explore",
  produce: "Create",
  evaluate: "Evaluate",
  human_gate: "Human Gate",
  deliver: "Deliver",
};

export function AgentStudio(props: AgentStudioProps) {
  return <ReactFlowProvider><AgentStudioInner {...props} /></ReactFlowProvider>;
}

function AgentStudioInner({
  agent,
  conversation,
  managementSession,
  workspace,
  runActive,
  onBack,
  onOpenChat,
  onCoachSend,
  onCancelRun,
  onRevisionChange,
  onNotify,
}: AgentStudioProps) {
  const [snapshot, setSnapshot] = useState<HireMeAgentStudioSnapshot | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StudioNodeData>>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("analyze");
  const [patch, setPatch] = useState<HireMeAgentGraphPatch | null>(null);
  const [preview, setPreview] = useState<HireMeAgentGraphPatchPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coachOpen, setCoachOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [coachDraft, setCoachDraft] = useState("");
  const [task, setTask] = useState("SaaS 랜딩페이지 시안을 검토하고 가장 중요한 수정 우선순위를 알려줘.");
  const [runId, setRunId] = useState("");
  const [runResult, setRunResult] = useState<HireMeAgentGraphRunResult | null>(null);
  const [graphRunning, setGraphRunning] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, string>>({});
  const [runError, setRunError] = useState("");

  const request = useMemo(() => ({
    conversationId: conversation.id,
    agentId: agent.id,
    managementSessionId: managementSession.id,
  }), [agent.id, conversation.id, managementSession.id]);

  const loadSnapshot = useCallback(async () => {
    const desktop = window.hiremeDesktop;
    if (!desktop) return;
    setLoading(true);
    try {
      const next = await desktop.getAgentStudioSnapshot(request);
      setSnapshot(next);
      setPatch(patchFromGraph(next.graph));
      setPreview(null);
    } catch (error) {
      onNotify("Agent Studio를 열지 못했어요", publicStudioError(error));
    } finally {
      setLoading(false);
    }
  }, [onNotify, request]);

  useEffect(() => { void loadSnapshot(); }, [loadSnapshot]);

  useEffect(() => {
    if (!snapshot) return;
    setNodes(snapshot.graph.nodes.map((graphNode, index) => ({
      id: graphNode.id,
      type: "studioNode",
      position: snapshot.layout.positions[graphNode.id] || defaultPosition(index),
      data: {
        label: titleForNode(graphNode.id),
        typeLabel: nodeTypeLabels[graphNode.type] || graphNode.type,
        skillRef: graphNode.skillRef,
        status: "idle",
      },
    })));
  }, [setNodes, snapshot]);

  useEffect(() => {
    setNodes((current) => current.map((node) => ({
      ...node,
      data: {
        ...node.data,
        skillRef: patch?.skillRefs[node.id] || null,
        status: nodeStatuses[node.id] || "idle",
      },
    })));
  }, [nodeStatuses, patch?.skillRefs, setNodes]);

  useEffect(() => {
    const desktop = window.hiremeDesktop;
    if (!desktop) return;
    return desktop.onAgentStudioEvent((event) => {
      if (event.conversationId !== conversation.id || (runId && event.runId !== runId)) return;
      if (event.nodeId) {
        setNodeStatuses((current) => ({
          ...current,
          [event.nodeId!]: event.type === "node_started"
            ? "running"
            : event.type === "graph_paused"
              ? "waiting"
              : event.type === "graph_completed" && event.status !== "completed"
                ? event.status || "failed"
                : ["revision_requested", "revise"].includes(event.outcome || "")
                  ? "revision_requested"
                  : "passed",
        }));
      }
    });
  }, [conversation.id, runId]);

  const edges = useMemo(() => (snapshot?.graph.edges || []).map((edge, index) => {
    const active = nodeStatuses[edge.from] === "running" || nodeStatuses[edge.to] === "running";
    return {
      id: `${edge.from}-${edge.when}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      label: edge.when,
      animated: active,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
      className: edge.loop ? "studio-edge revision-loop" : "studio-edge",
      style: edge.loop ? { strokeDasharray: "7 5" } : undefined,
    };
  }), [nodeStatuses, snapshot]);

  const selectedGraphNode = snapshot?.graph.nodes.find((node) => node.id === selectedNodeId) || null;
  const dirty = Boolean(snapshot && patch && JSON.stringify(patch) !== JSON.stringify(patchFromGraph(snapshot.graph)));

  const updatePatch = (next: Partial<HireMeAgentGraphPatch>) => {
    setPatch((current) => current ? { ...current, ...next } : current);
    setPreview(null);
  };

  const previewChanges = async () => {
    if (!snapshot || !patch || !window.hiremeDesktop) return;
    setSaving(true);
    try {
      const next = await window.hiremeDesktop.previewAgentGraphPatch({
        ...request,
        expectedRevision: snapshot.revision,
        expectedGraphDigest: snapshot.graphValidation.digest,
        patch,
      });
      setPreview(next);
    } catch (error) {
      onNotify("그래프 변경을 미리 볼 수 없어요", publicStudioError(error));
    } finally {
      setSaving(false);
    }
  };

  const applyChanges = async () => {
    if (!snapshot || !patch || !window.hiremeDesktop) return;
    setSaving(true);
    try {
      const result = await window.hiremeDesktop.applyAgentGraphPatch({
        ...request,
        expectedRevision: snapshot.revision,
        expectedGraphDigest: snapshot.graphValidation.digest,
        patch,
      });
      onRevisionChange(result.phase, result.revision);
      onNotify("그래프 변경을 적용했어요", `revision ${result.revision}`);
      await loadSnapshot();
    } catch (error) {
      onNotify("그래프 변경을 적용하지 못했어요", publicStudioError(error));
    } finally {
      setSaving(false);
    }
  };

  const saveLayout = async (
    positionOverrides: Record<string, { x: number; y: number }> = {},
    viewport = snapshot?.layout.viewport || { x: 0, y: 0, zoom: 1 },
  ) => {
    if (!window.hiremeDesktop) return;
    const positions = {
      ...Object.fromEntries(nodes.map((node) => [node.id, node.position])),
      ...positionOverrides,
    };
    await window.hiremeDesktop.saveAgentStudioLayout({
      ...request,
      layout: { positions, viewport },
    }).catch(() => null);
  };

  const runGraph = async () => {
    if (!window.hiremeDesktop || !task.trim()) return;
    const nextRunId = `studio-${Date.now().toString(36)}`;
    setRunId(nextRunId);
    setRunResult(null);
    setRunError("");
    setNodeStatuses({});
    setGraphRunning(true);
    try {
      const result = await window.hiremeDesktop.runAgentStudioGraph({ ...request, runId: nextRunId, task: task.trim(), workspace });
      setRunResult(result);
    } catch (error) {
      setRunError(publicStudioError(error));
    } finally {
      setGraphRunning(false);
    }
  };

  const resumeGraph = async (decision: "approved" | "revision_requested") => {
    if (!window.hiremeDesktop || !runId) return;
    setRunError("");
    setGraphRunning(true);
    try {
      const result = await window.hiremeDesktop.resumeAgentStudioGraph({ ...request, runId, decision, workspace });
      setRunResult(result);
    } catch (error) {
      setRunError(publicStudioError(error));
    } finally {
      setGraphRunning(false);
    }
  };

  const submitCoach = () => {
    const text = coachDraft.trim();
    if (!text) return;
    onCoachSend(`Agent Studio 제안 모드입니다. 변경을 바로 적용하지 말고, 어떤 노드와 설정을 바꾸면 좋을지 제안만 해주세요.\n\n${text}`);
    setCoachDraft("");
  };

  if (loading || !snapshot || !patch) {
    return <div className="agent-studio-loading"><RefreshCw className="spin" size={20} /> Agent Studio를 준비하고 있어요</div>;
  }

  return (
    <section className={`agent-studio ${coachOpen ? "coach-open" : ""} ${inspectorOpen ? "inspector-open" : ""}`}>
      <header className="agent-studio-header">
        <button className="studio-icon-button" type="button" onClick={onBack} aria-label="뒤로"><ChevronLeft size={18} /></button>
        <div><strong>{agent.name}</strong><span>Agent Studio · revision {snapshot.revision}</span></div>
        <div className="studio-health"><ShieldCheck size={14} /> {snapshot.graphValidation.valid ? "Graph valid" : "Needs attention"}</div>
        <button className="studio-secondary-button" type="button" onClick={() => setCoachOpen((value) => !value)}><MessageSquare size={15} /> Coach</button>
        <button className="studio-primary-button" type="button" disabled={!dirty || saving} onClick={() => void previewChanges()}><Save size={15} /> 변경 미리보기</button>
      </header>

      {coachOpen && (
        <aside className="studio-coach-panel">
          <div className="studio-panel-heading"><div><Sparkles size={15} /><strong>Coach</strong></div><button onClick={() => setCoachOpen(false)}><X size={15} /></button></div>
          <p>대화로 방향을 잡고, 실제 변경은 캔버스에서 미리 본 뒤 적용합니다.</p>
          <div className="studio-coach-messages">
            {conversation.messages.slice(-6).map((message) => <div key={message.id} className={`studio-coach-message ${message.role}`}>{message.text}</div>)}
          </div>
          <textarea value={coachDraft} onChange={(event) => setCoachDraft(event.target.value)} placeholder="이 Agent가 어떻게 일해야 하는지 알려주세요" />
          <div className="studio-coach-actions"><button type="button" onClick={onOpenChat}>전체 채팅</button><button type="button" disabled={!coachDraft.trim() || runActive} onClick={submitCoach}>제안 받기</button></div>
        </aside>
      )}

      <main className="studio-canvas-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => { setSelectedNodeId(node.id); setInspectorOpen(true); }}
          onNodeDragStop={(_, node) => void saveLayout({ [node.id]: node.position })}
          onMoveEnd={(_, viewport) => void saveLayout({}, viewport)}
          nodesConnectable={false}
          edgesReconnectable={false}
          defaultViewport={snapshot.layout.viewport}
          fitView={Object.keys(snapshot.layout.positions).length === 0}
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.35}
          maxZoom={1.5}
        >
          <Background gap={22} size={1} color="#dfe5e1" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(node) => node.data.status === "running" ? "#3d7a5b" : "#b9c6be"} />
        </ReactFlow>
      </main>

      {inspectorOpen && (
        <aside className="studio-node-inspector">
          <div className="studio-panel-heading"><div><strong>Node settings</strong></div><button onClick={() => setInspectorOpen(false)}><ChevronRight size={16} /></button></div>
          {selectedGraphNode && <>
            <div className="studio-node-title"><span>{nodeTypeLabels[selectedGraphNode.type]}</span><h2>{titleForNode(selectedGraphNode.id)}</h2><p>{selectedGraphNode.completionGate.join(" · ")}</p></div>
            <label>Private skill<select value={patch.skillRefs[selectedGraphNode.id] || ""} onChange={(event) => updatePatch({ skillRefs: { ...patch.skillRefs, [selectedGraphNode.id]: event.target.value || null } })}><option value="">No skill</option>{snapshot.skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.title || skill.id}</option>)}</select></label>
            {["analyze", "decide", "explore"].includes(selectedGraphNode.id) && <div className="studio-order-controls"><span>실행 순서</span><button type="button" onClick={() => updatePatch({ middleOrder: moveItem(patch.middleOrder, selectedGraphNode.id, -1) })}>위로</button><button type="button" onClick={() => updatePatch({ middleOrder: moveItem(patch.middleOrder, selectedGraphNode.id, 1) })}>아래로</button></div>}
          </>}
          <div className="studio-global-settings">
            <label><span>Explore node</span><input type="checkbox" checked={patch.exploreEnabled} onChange={(event) => updatePatch({ exploreEnabled: event.target.checked })} /></label>
            <label><span>Human Gate</span><input type="checkbox" checked={patch.humanGateEnabled} onChange={(event) => updatePatch({ humanGateEnabled: event.target.checked })} /></label>
            <label><span>Revision attempts</span><input type="range" min="1" max="5" value={patch.maxRevisionAttempts} onChange={(event) => updatePatch({ maxRevisionAttempts: Number(event.target.value) })} /><b>{patch.maxRevisionAttempts}</b></label>
          </div>
        </aside>
      )}

      {preview && (
        <div className="studio-change-review"><div><strong>revision {preview.baseRevision} → {preview.candidateRevision}</strong><span>{preview.validation.valid ? "검증을 통과했습니다" : "수정이 필요합니다"}</span></div><button type="button" onClick={() => setPreview(null)}><X size={14} /> 취소</button><button className="studio-primary-button" type="button" disabled={saving || !preview.validation.valid} onClick={() => void applyChanges()}><Check size={14} /> Apply</button></div>
      )}

      <section className="studio-run-drawer">
        <div className="studio-run-heading"><div><Play size={15} /><strong>Playground</strong><span>실제 그래프 경로를 실행합니다</span></div><button type="button" disabled={runActive || graphRunning} onClick={() => void runGraph()}><Play size={14} /> Run</button></div>
        <textarea value={task} onChange={(event) => setTask(event.target.value)} />
        {runResult?.status === "waiting_for_human" && <div className="studio-human-gate"><strong>Human Gate에서 기다리고 있어요</strong><span>결과를 승인하거나 수정 루프로 돌려보내세요.</span><button type="button" onClick={() => void resumeGraph("revision_requested")}><RotateCcw size={14} /> 수정 요청</button><button type="button" onClick={() => void resumeGraph("approved")}><Check size={14} /> 승인</button></div>}
        {runResult?.outputText && <div className="studio-run-result">{runResult.outputText}</div>}
        {runError && <div className="studio-run-error">{runError}</div>}
        {runId && graphRunning && <button className="studio-cancel-run" type="button" onClick={() => { onCancelRun(runId); setGraphRunning(false); }}>실행 취소</button>}
      </section>
    </section>
  );
}

function StudioGraphNode({ data, selected }: NodeProps<Node<StudioNodeData>>) {
  return <div className={`studio-graph-node status-${data.status} ${selected ? "selected" : ""}`}>
    <Handle type="target" position={Position.Left} />
    <span className="studio-node-kind">{data.typeLabel}</span>
    <strong>{data.label}</strong>
    <small>{data.skillRef || "System rule"}</small>
    <span className="studio-node-status">{data.status}</span>
    <Handle type="source" position={Position.Right} />
  </div>;
}

function patchFromGraph(graph: HireMeAgentGraph): HireMeAgentGraphPatch {
  return {
    middleOrder: graph.nodes.map((node) => node.id).filter((id) => ["analyze", "decide", "explore"].includes(id)),
    exploreEnabled: graph.nodes.some((node) => node.id === "explore"),
    humanGateEnabled: graph.nodes.some((node) => node.id === "human-gate"),
    maxRevisionAttempts: graph.budgets.maxRevisionAttempts,
    skillRefs: Object.fromEntries(graph.nodes.map((node) => [node.id, node.skillRef])),
  };
}

function defaultPosition(index: number) {
  return { x: 70 + index * 230, y: index % 2 === 0 ? 150 : 280 };
}

function titleForNode(id: string) {
  return id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function moveItem(items: string[], id: string, delta: number) {
  const next = [...items];
  const index = next.indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function publicStudioError(error: unknown) {
  return String(error instanceof Error ? error.message : error || "Unknown error").replace(/^Error invoking remote method '[^']+':\s*/, "");
}
