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
  neighborsOf,
  positionOf,
  type ConceptFlowNode,
  type ConceptNodeData,
} from "@/lib/graph";
import type { IntelligenceData } from "@/lib/types";
import { ConceptNode } from "./ConceptNode";
import { ProgressProvider, useProgress } from "./ProgressProvider";
import { SidePanel } from "./SidePanel";
import { SynapseEdge } from "./SynapseEdge";
import { TopBar } from "./TopBar";

const data = rawData as IntelligenceData;

// Declared at module scope: inline objects here make React Flow remount every
// node on each render, which is a documented and very expensive mistake.
const nodeTypes = { concept: ConceptNode };
const edgeTypes = { synapse: SynapseEdge };

const MINIMAP_STYLE = {
  backgroundColor: "oklch(0.12 0.015 265 / 0.92)",
  border: "1px solid oklch(1 0 0 / 0.09)",
  borderRadius: 14,
  boxShadow: "0 12px 36px oklch(0 0 0 / 0.22)",
} as const;

const focusEase = (t: number) => 1 - Math.pow(1 - t, 4);

function Graph() {
  const { xpByNodeId, hydrated } = useProgress();
  const { getZoom, setViewport } = useReactFlow<ConceptFlowNode>();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    () => new Set(),
  );

  const categories = useMemo(() => indexBy(data.categories), []);
  const nodesById = useMemo(() => indexBy(data.nodes), []);

  const visible = useMemo(
    () => matchingNodeIds(data, search, activeCategories),
    [search, activeCategories],
  );

  const focusIds = useMemo(() => {
    if (!selectedId) return null;
    const ids = new Set<string>([selectedId]);
    for (const neighbor of neighborsOf(data, selectedId)) ids.add(neighbor.id);
    return ids;
  }, [selectedId]);

  const nodes = useMemo(
    () =>
      buildNodes(
        data,
        xpByNodeId,
        categories,
        visible,
        selectedId,
        focusIds,
      ),
    [xpByNodeId, categories, visible, selectedId, focusIds],
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
      ),
    [xpByNodeId, categories, nodesById, visible, selectedId],
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

      // The detail panel overlays the canvas. Aim the camera at the centre of
      // the *visible* graph area so the focused node never lands beneath it.
      const panelWidth = isNarrow ? 0 : 420;
      const targetScreenX = (window.innerWidth - panelWidth) / 2;
      const targetScreenY = isNarrow
        ? Math.min(window.innerHeight * 0.2, 180)
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
        onPaneClick={() => setSelectedId(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        // Deliberately NOT onlyRenderVisibleElements: it leaves offscreen nodes
        // unmeasured, which empties the MiniMap and causes pop-in while panning.
        // 100 nodes and 188 edges render fine without it.
        minZoom={0.12}
        maxZoom={2.4}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        proOptions={{ hideAttribution: false }}
        className={hydrated ? "opacity-100" : "opacity-0"}
        style={{ transition: "opacity 400ms ease" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={32}
          size={1.15}
          color="oklch(0.38 0.035 265)"
        />
        <Controls
          showInteractive={false}
          className="!bottom-4 !left-4 !border !border-white/10 !bg-black/50 !backdrop-blur-xl"
        />
        <MiniMap
          pannable
          zoomable
          style={MINIMAP_STYLE}
          maskColor="oklch(0.1 0.01 265 / 0.72)"
          nodeColor={(node) => {
            const d = node.data as ConceptNodeData;
            return `oklch(${d.lightness} ${d.chroma} ${d.hue})`;
          }}
          className="!bottom-4 !right-4 hidden md:!block"
        />
      </ReactFlow>

      <TopBar
        data={data}
        search={search}
        onSearchChange={setSearch}
        onSelectNode={focusNode}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        onClearFilters={() => setActiveCategories(new Set())}
      />

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[10px] text-neutral-500 shadow-lg backdrop-blur-xl lg:flex">
        <span>Click a faculty to focus</span>
        <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden="true" />
        <span>Drag to pan</span>
        <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden="true" />
        <span>Scroll to zoom</span>
      </div>

      <SidePanel
        data={data}
        node={selectedNode}
        category={selectedCategory}
        nodesById={nodesById}
        onClose={() => setSelectedId(null)}
        onSelectNode={focusNode}
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
