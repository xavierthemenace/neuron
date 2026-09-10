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
  backgroundColor: "oklch(0.12 0.015 265)",
  border: "1px solid oklch(1 0 0 / 0.08)",
  borderRadius: 12,
} as const;

function Graph() {
  const { xpByNodeId, hydrated } = useProgress();
  const { fitView } = useReactFlow();

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

  // Only the touched node's data object changes identity here, so React Flow's
  // shallow compare re-renders one orb per log rather than all hundred.
  const nodes = useMemo(
    () => buildNodes(data, xpByNodeId, categories, visible),
    [xpByNodeId, categories, visible],
  );

  const edges = useMemo(
    () => buildEdges(data, xpByNodeId, categories, nodesById, visible),
    [xpByNodeId, categories, nodesById, visible],
  );

  const focusNode = useCallback(
    (id: string) => {
      setSelectedId(id);
      // fitView must be in the dep array — it is a no-op until the viewport
      // has initialised.
      void fitView({ nodes: [{ id }], duration: 500, maxZoom: 1.3, padding: 3 });
    },
    [fitView],
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
          gap={34}
          size={1}
          color="oklch(0.34 0.03 265)"
        />
        <Controls
          showInteractive={false}
          className="!bottom-4 !left-4 !border !border-white/10 !bg-black/50 !backdrop-blur-xl"
        />
        <MiniMap
          pannable
          zoomable
          style={MINIMAP_STYLE}
          maskColor="oklch(0.1 0.01 265 / 0.75)"
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
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        onClearFilters={() => setActiveCategories(new Set())}
      />

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
