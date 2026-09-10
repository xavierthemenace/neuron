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
import { useCallback, useMemo, useState } from "react";
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
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { ClusterBackdrop } from "./ClusterBackdrop";
import { CommandPalette } from "./CommandPalette";
import { ConceptNode } from "./ConceptNode";
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
        elementsSelectable
        minZoom={0.12}
        maxZoom={2.6}
        fitView
        fitViewOptions={{ padding: 0.13 }}
        proOptions={{ hideAttribution: false }}
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

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[10px] text-neutral-400 shadow-lg backdrop-blur-xl xl:flex">
        <span>Click faculty to focus</span>
        <span className="h-1 w-1 rounded-full bg-white/25" aria-hidden="true" />
        <span>Cmd/Ctrl K commands</span>
        <span className="h-1 w-1 rounded-full bg-white/25" aria-hidden="true" />
        <span>Map guide explains pathways</span>
      </div>

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
