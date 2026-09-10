"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import rawData from "@/data/intelligenceData.json";
import {
  buildEdges,
  buildNodes,
  indexBy,
  matchingNodeIds,
  positionOf,
  type ConceptFlowNode,
  type ConceptNodeData,
} from "@/lib/graph";
import { neighborsWithinDepth } from "@/lib/training";
import type { IntelligenceData } from "@/lib/types";
import { AICoach } from "./AICoach";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { ClusterBackdrop } from "./ClusterBackdrop";
import { CommandPalette } from "./CommandPalette";
import { ConceptNode } from "./ConceptNode";
import { DailyWorkout } from "./DailyWorkout";
import { GraphNavigator } from "./GraphNavigator";
import { ProgressProvider, useProgress } from "./ProgressProvider";
import { SidePanel } from "./SidePanel";
import { SynapseEdge } from "./SynapseEdge";
import { TopBar } from "./TopBar";

const data = rawData as IntelligenceData;
const nodeTypes = { concept: ConceptNode };
const edgeTypes = { synapse: SynapseEdge };

const MINIMAP_STYLE = {
  backgroundColor: "oklch(0.105 0.015 265 / 0.96)",
  border: "1px solid oklch(1 0 0 / 0.12)",
  borderRadius: 14,
  boxShadow: "0 14px 42px oklch(0 0 0 / 0.3)",
} as const;

const focusEase = (t: number) => 1 - Math.pow(1 - t, 4);

function Graph() {
  const { xpByNodeId, decayByNodeId, lastLogSignal, hydrated } = useProgress();
  const { fitView, getZoom, setViewport } = useReactFlow<ConceptFlowNode>();

  // App-owned selection is the single source of truth. Do not mirror React
  // Flow's internal selection back into this state via onSelectionChange: doing
  // so can re-select a node while a close/switch update is propagating and form
  // a render feedback loop.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    () => new Set(),
  );
  const [focusMode, setFocusMode] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const categories = useMemo(() => indexBy(data.categories), []);
  const nodesById = useMemo(() => indexBy(data.nodes), []);

  const visible = useMemo(
    () => matchingNodeIds(data, search, activeCategories),
    [search, activeCategories],
  );

  const focusIds = useMemo(() => {
    if (!selectedId) return null;
    return neighborsWithinDepth(data, selectedId, focusMode ? 2 : 1);
  }, [focusMode, selectedId]);

  const retentionByNodeId = useMemo(() => {
    const retention: Record<string, number> = {};
    for (const [nodeId, state] of Object.entries(decayByNodeId)) {
      retention[nodeId] = state.retention;
    }
    return retention;
  }, [decayByNodeId]);

  const nodes = useMemo(
    () =>
      buildNodes(
        data,
        xpByNodeId,
        categories,
        visible,
        selectedId,
        focusIds,
        focusMode,
        retentionByNodeId,
      ),
    [
      xpByNodeId,
      categories,
      visible,
      selectedId,
      focusIds,
      focusMode,
      retentionByNodeId,
    ],
  );

  const edges = useMemo(
    () =>
      buildEdges(
        data,
        xpByNodeId,
        categories,
        nodesById,
        visible,
        selectedId,
        focusIds,
        focusMode,
        lastLogSignal,
      ),
    [
      xpByNodeId,
      categories,
      nodesById,
      visible,
      selectedId,
      focusIds,
      focusMode,
      lastLogSignal,
    ],
  );

  const focusNode = useCallback(
    (id: string) => {
      setSelectedId(id);

      const point = positionOf(id);
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const isNarrow = window.innerWidth < 768;
      const targetZoom = Math.max(getZoom(), 1.55);
      const panelWidth = isNarrow ? 0 : 420;
      const targetScreenX = (window.innerWidth - panelWidth) / 2;
      const targetScreenY = isNarrow
        ? Math.min(window.innerHeight * 0.18, 160)
        : window.innerHeight / 2;

      void setViewport(
        {
          x: targetScreenX - point.x * targetZoom,
          y: targetScreenY - point.y * targetZoom,
          zoom: targetZoom,
        },
        {
          duration: reducedMotion ? 0 : 720,
          ease: focusEase,
          interpolate: "smooth",
        },
      );
    },
    [getZoom, setViewport],
  );

  const fitAll = useCallback(() => {
    void fitView({ padding: 0.14, duration: 520, maxZoom: 1.1 });
  }, [fitView]);

  const setFocusModeAndFrame = useCallback(
    (enabled: boolean) => {
      setFocusMode(enabled);
      if (!enabled || !selectedId) return;
      const ids = Array.from(neighborsWithinDepth(data, selectedId, 2));
      requestAnimationFrame(() => {
        void fitView({
          nodes: ids.map((id) => ({ id })),
          padding: 0.58,
          duration: 560,
          maxZoom: 1.5,
        });
      });
    },
    [fitView, selectedId],
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setFocusMode(false);
  }, []);

  const onNodeClick = useCallback<NodeMouseHandler<ConceptFlowNode>>(
    (_event, node) => focusNode(node.id),
    [focusNode],
  );

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".react-flow__node")) return;

      const origin = positionOf(selectedId);
      const candidates = data.nodes
        .filter((node) => node.id !== selectedId)
        .map((node) => {
          const point = positionOf(node.id);
          const dx = point.x - origin.x;
          const dy = point.y - origin.y;
          const valid =
            (event.key === "ArrowRight" && dx > 8) ||
            (event.key === "ArrowLeft" && dx < -8) ||
            (event.key === "ArrowDown" && dy > 8) ||
            (event.key === "ArrowUp" && dy < -8);
          const primary = event.key === "ArrowLeft" || event.key === "ArrowRight" ? Math.abs(dx) : Math.abs(dy);
          const cross = event.key === "ArrowLeft" || event.key === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
          return { node, valid, score: primary + cross * 0.72 };
        })
        .filter((candidate) => candidate.valid)
        .sort((a, b) => a.score - b.score);
      const next = candidates[0]?.node;
      if (!next) return;

      event.preventDefault();
      focusNode(next.id);
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`.react-flow__node[data-id="${next.id}"]`)
          ?.focus();
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusNode, selectedId]);

  const toggleCategory = useCallback((id: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedNode = selectedId ? (nodesById.get(selectedId) ?? null) : null;
  const selectedCategory = selectedNode
    ? (categories.get(selectedNode.categoryId) ?? null)
    : null;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[var(--surface)]">
      <ReactFlow<ConceptFlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={clearSelection}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable
        edgesFocusable={false}
        disableKeyboardA11y={false}
        autoPanOnNodeFocus
        elementsSelectable
        minZoom={0.12}
        maxZoom={2.6}
        fitView
        fitViewOptions={{ padding: 0.13 }}
        proOptions={{ hideAttribution: false }}
        ariaLabelConfig={{
          "node.a11yDescription.default": "Press Enter to open this faculty. Use Tab to move through faculties, or arrow keys after selecting one to move spatially.",
          "minimap.ariaLabel": "Neuron cognitive map overview",
          "controls.ariaLabel": "Graph zoom and fit controls",
        }}
        className={hydrated ? "opacity-100" : "opacity-0"}
        style={{ transition: "opacity 400ms ease" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={31}
          size={1.2}
          color="oklch(0.42 0.035 265)"
        />
        <ClusterBackdrop data={data} />
        <Controls
          showInteractive={false}
          className="!bottom-3 !left-3 !border !border-white/12 !bg-black/65 !backdrop-blur-xl md:!bottom-4 md:!left-4"
        />
        <MiniMap
          pannable
          zoomable
          style={MINIMAP_STYLE}
          maskColor="oklch(0.08 0.01 265 / 0.7)"
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            const nodeData = node.data as ConceptNodeData;
            return `oklch(${nodeData.lightness} ${nodeData.chroma} ${nodeData.hue})`;
          }}
          className={[
            "!bottom-3 !right-3 !h-24 !w-36 transition-[right] duration-300 md:!bottom-4 md:!h-[116px] md:!w-[176px]",
            selectedNode ? "md:!right-[436px]" : "md:!right-4",
          ].join(" ")}
        />
      </ReactFlow>

      <TopBar
        data={data}
        search={search}
        onSearchChange={setSearch}
        onSelectNode={focusNode}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        onClearFilters={() => setActiveCategories(new Set())}
      />

      <GraphNavigator
        data={data}
        selectedNode={selectedNode}
        nodesById={nodesById}
        onSelectNode={focusNode}
        onFitView={fitAll}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusModeAndFrame(!focusMode)}
      />

      <DailyWorkout data={data} onSelectNode={focusNode} panelOpen={Boolean(selectedNode)} />
      <AICoach data={data} selectedNode={selectedNode} onSelectNode={focusNode} />

      <SidePanel
        data={data}
        node={selectedNode}
        category={selectedCategory}
        nodesById={nodesById}
        onClose={clearSelection}
        onSelectNode={focusNode}
        focusMode={focusMode}
        onFocusModeChange={setFocusModeAndFrame}
      />

      <AnalyticsDashboard
        data={data}
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
      />

      <CommandPalette
        data={data}
        selectedId={selectedId}
        onSelectNode={focusNode}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onFitView={fitAll}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusModeAndFrame(!focusMode)}
      />
    </div>
  );
}

export default function NeuralGraph() {
  return (
    <ProgressProvider>
      <ReactFlowProvider>
        <Graph />
      </ReactFlowProvider>
    </ProgressProvider>
  );
}
