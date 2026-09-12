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
import { curriculum, pathsById } from "@/lib/curriculum";
import {
  buildEdges,
  buildNodes,
  indexBy,
  matchingNodeIds,
  positionOf,
  type ConceptFlowNode,
  type ConceptNodeData,
} from "@/lib/graph";
import { installDevTools, note } from "@/lib/devtools";
import { buildInbox, inboxNodeIds } from "@/lib/inbox";
import { matchingNodeIdsFor } from "@/lib/search";
import { neighborsWithinDepth } from "@/lib/training";
import { AICoach } from "./AICoach";
import { AppNav, type Screen } from "./AppNav";
import { ClusterBackdrop } from "./ClusterBackdrop";
import { CommandPalette } from "./CommandPalette";
import { ConceptNode } from "./ConceptNode";
import { DiagnosticRunner } from "./DiagnosticRunner";
import { ErrorBoundary } from "./ErrorBoundary";
import { GraphNavigator } from "./GraphNavigator";
import { CapstoneRunner, MissionRunner } from "./MissionRunner";
import { MigrationNotice } from "./MigrationNotice";
import { Onboarding } from "./Onboarding";
import { ProgressProvider, useProgress } from "./ProgressProvider";
import { SessionPlanner } from "./SessionPlanner";
import { SidePanel } from "./SidePanel";
import { SynapseEdge } from "./SynapseEdge";
import { Today } from "./Today";
import { TopBar } from "./TopBar";
import { Workbench, type WorkbenchTab } from "./Workbench";

const data = curriculum;
const nodeTypes = { concept: ConceptNode };
const edgeTypes = { synapse: SynapseEdge };

const MINIMAP_STYLE = {
  backgroundColor: "oklch(0.105 0.015 265 / 0.96)",
  border: "1px solid oklch(1 0 0 / 0.12)",
  borderRadius: 14,
  boxShadow: "0 14px 42px oklch(0 0 0 / 0.3)",
} as const;

const focusEase = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * Duration for a camera move, honouring the user's motion preference.
 *
 * Every camera move routes through here. Panning to a selection already
 * respected `prefers-reduced-motion`, but the framing sweeps (fit-all, Focus
 * Mode, path framing) did not, so a user who asked for reduced motion still got
 * half-second camera tweens.
 */
const cameraDuration = (ms: number) =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : ms;

const GRAPH_DESCRIPTION =
  "Press Enter to open this capability. Use Tab to move between capabilities, or the arrow keys after selecting one to move across the map. Press B at any time for a full list view that does not require the map at all.";

function Graph() {
  const model = useProgress();
  const { xpByNodeId, estimates, retentionByNodeId, lastLogSignal, hydrated, progress } =
    model;
  const { fitView, getZoom, setViewport } = useReactFlow<ConceptFlowNode>();

  // App-owned selection is the single source of truth. Do not mirror React
  // Flow's internal selection back into this state via onSelectionChange: doing
  // so can re-select a node while a close/switch update is propagating and form
  // a render feedback loop.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(() => new Set());
  const [focusMode, setFocusMode] = useState(false);
  const [researchMode, setResearchMode] = useState(false);

  const [workbench, setWorkbench] = useState<WorkbenchTab | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [probeId, setProbeId] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [capstoneId, setCapstoneId] = useState<string | null>(null);
  const [activePathId, setActivePathId] = useState<string | null>(null);
  // The app opens on Today. The map is a destination, not the front door.
  const [screen, setScreen] = useState<Screen>("today");
  // Closing the workbench returns you where you opened it from: arriving back
  // on Today would lose the map you were reading.
  const [returnScreen, setReturnScreen] = useState<Screen>("today");

  useEffect(() => {
    installDevTools();
  }, []);

  const categories = useMemo(() => indexBy(data.categories), []);
  const nodesById = useMemo(() => indexBy(model.nodes), [model.nodes]);

  const visible = useMemo(() => {
    const matches = search.trim()
      ? matchingNodeIdsFor(search, progress.personalNodes)
      : null;
    return matchingNodeIds(data, matches, activeCategories);
  }, [search, activeCategories, progress.personalNodes]);

  const focusIds = useMemo(() => {
    if (!selectedId) return null;
    return neighborsWithinDepth(data, selectedId, focusMode ? 2 : 1);
  }, [focusMode, selectedId]);

  const pathIds = useMemo(() => {
    if (activePathId) return new Set(pathsById.get(activePathId)?.nodeIds ?? []);
    const active = progress.goals.filter((goal) => goal.status === "active");
    if (active.length === 0) return null;
    return new Set(active.flatMap((goal) => goal.nodeIds));
  }, [activePathId, progress.goals]);

  const inbox = useMemo(() => buildInbox(model, progress), [model, progress]);
  const flaggedIds = useMemo(() => inboxNodeIds(inbox), [inbox]);

  const nodes = useMemo(
    () =>
      buildNodes(data, {
        xpByNodeId,
        categories,
        estimates,
        retentionByNodeId,
        visible,
        selectedId,
        focusIds,
        focusMode,
        pathIds,
        flaggedIds,
      }),
    [
      xpByNodeId,
      categories,
      estimates,
      retentionByNodeId,
      visible,
      selectedId,
      focusIds,
      focusMode,
      pathIds,
      flaggedIds,
    ],
  );

  const edges = useMemo(
    () =>
      buildEdges(data, {
        xpByNodeId,
        categories,
        nodesById,
        visible,
        selectedId,
        focusIds,
        focusMode,
        burstSignal: lastLogSignal,
      }),
    [xpByNodeId, categories, nodesById, visible, selectedId, focusIds, focusMode, lastLogSignal],
  );

  const focusNode = useCallback(
    (id: string) => {
      note("select", id);
      setSelectedId(id);

      const point = positionOf(id);
      const isNarrow = window.innerWidth < 768;
      const targetZoom = Math.max(getZoom(), 1.55);
      const panelWidth = isNarrow ? 0 : 440;
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
          duration: cameraDuration(720),
          ease: focusEase,
          interpolate: "smooth",
        },
      );
    },
    [getZoom, setViewport],
  );

  const fitAll = useCallback(() => {
    void fitView({ padding: 0.14, duration: cameraDuration(520), maxZoom: 1.1 });
  }, [fitView]);

  /**
   * Focus Mode framing.
   *
   * The old padding of 0.58 meant more than half the frame was margin, so a
   * wide depth-2 neighbourhood pushed the camera out past 0.4 and the labels —
   * the whole point of isolating a network — became unreadable. A floor on the
   * zoom is the honest trade: show the neighbourhood as far as it fits, and
   * keep it legible rather than complete. Turning the mode off used to leave
   * the camera wherever it had been pushed; it now comes back to the selection.
   */
  const setFocusModeAndFrame = useCallback(
    (enabled: boolean) => {
      setFocusMode(enabled);
      if (!selectedId) return;
      if (!enabled) {
        focusNode(selectedId);
        return;
      }
      const ids = Array.from(neighborsWithinDepth(data, selectedId, 2));
      requestAnimationFrame(() => {
        void fitView({
          nodes: ids.map((id) => ({ id })),
          padding: 0.24,
          duration: cameraDuration(560),
          minZoom: 0.62,
          maxZoom: 1.5,
        });
      });
    },
    [fitView, focusNode, selectedId],
  );

  const showPath = useCallback(
    (pathId: string) => {
      setActivePathId(pathId);
      const ids = pathsById.get(pathId)?.nodeIds ?? [];
      if (ids.length === 0) return;
      requestAnimationFrame(() => {
        void fitView({
          nodes: ids.map((id) => ({ id })),
          padding: 0.4,
          duration: cameraDuration(620),
          maxZoom: 1.2,
        });
      });
    },
    [fitView],
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
          const primary =
            event.key === "ArrowLeft" || event.key === "ArrowRight"
              ? Math.abs(dx)
              : Math.abs(dy);
          const cross =
            event.key === "ArrowLeft" || event.key === "ArrowRight"
              ? Math.abs(dy)
              : Math.abs(dx);
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

  const frameCategories = useCallback(
    (categories: Set<string>) => {
      if (categories.size === 0) {
        fitAll();
        return;
      }
      const ids = data.nodes
        .filter((node) => categories.has(node.categoryId))
        .map((node) => ({ id: node.id }));
      if (ids.length === 0) return;
      requestAnimationFrame(() => {
        void fitView({
          nodes: ids,
          padding: 0.3,
          duration: cameraDuration(560),
          maxZoom: 1.2,
        });
      });
    },
    [fitAll, fitView],
  );

  const toggleCategory = useCallback(
    (id: string) => {
      setActiveCategories((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        frameCategories(next);
        return next;
      });
    },
    [frameCategories],
  );

  const openWorkbench = useCallback((tab: WorkbenchTab | null) => {
    setWorkbench(tab);
    if (!tab) return;
    setScreen((current) => {
      if (current !== "data") setReturnScreen(current);
      return "data";
    });
  }, []);

  const closeWorkbench = useCallback(() => {
    setWorkbench(null);
    setScreen(returnScreen);
  }, [returnScreen]);

  const selectedNode = selectedId ? (nodesById.get(selectedId) ?? null) : null;
  const selectedCategory = selectedNode
    ? (categories.get(selectedNode.categoryId) ?? null)
    : null;

  const inboxCount = inbox.length;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[var(--surface)]">
      {/* The canvas stays mounted so React Flow keeps its measurements, but a
          139-node graph behind an opaque screen is 139 tab stops a keyboard user
          has to walk through to reach anything. `inert` takes the whole layer out
          of the tab order, and out of the accessibility tree, while it is not the
          screen you are on. */}
      <div className="absolute inset-0" inert={screen !== "map"}>
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
          minZoom={0.08}
          maxZoom={2.6}
          fitView
          fitViewOptions={{ padding: 0.13 }}
          proOptions={{ hideAttribution: false }}
          ariaLabelConfig={{
            // Both keys, deliberately. React Flow selects the "keyboardDisabled"
            // string when keyboard accessibility is *enabled*, and its defaults
            // describe dragging and deleting nodes — neither of which this map
            // supports.
            "node.a11yDescription.default": GRAPH_DESCRIPTION,
            "node.a11yDescription.keyboardDisabled": GRAPH_DESCRIPTION,
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
            className="!bottom-[72px] !left-3 !border !border-white/12 !bg-[rgb(255_255_255_/_0.94)] !backdrop-blur-xl md:!bottom-4 md:!left-4"
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
              "!bottom-[72px] !right-3 !h-24 !w-36 transition-[right] duration-300 md:!bottom-4 md:!h-[116px] md:!w-[176px]",
              // Clears the capability rail, which grows with the display.
              selectedNode
                ? "md:!right-[456px] xl:!right-[512px] 2xl:!right-[576px]"
                : "md:!right-4",
            ].join(" ")}
          />
        </ReactFlow>
      </div>

      {(screen === "map" || (screen === "data" && returnScreen === "map")) && (
        <>
      <TopBar
        data={data}
        search={search}
        onSearchChange={setSearch}
        onSelectNode={focusNode}
        onOpenWorkbench={openWorkbench}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        onClearFilters={() => {
          setActiveCategories(new Set());
          fitAll();
        }}
        activePathId={activePathId}
        onShowPath={showPath}
        onClearPath={() => setActivePathId(null)}
        inboxCount={inboxCount}
      />

      <GraphNavigator
        data={data}
        selectedNode={selectedNode}
        nodesById={nodesById}
        onSelectNode={focusNode}
        onFitView={fitAll}
        onOpenAnalytics={() => openWorkbench("analytics")}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusModeAndFrame(!focusMode)}
      />

      <AICoach
        data={data}
        selectedNode={selectedNode}
        onSelectNode={focusNode}
        researchMode={researchMode}
      />

        </>
      )}

      {/* Paper covers the map plate on every screen that is not the map, so a
          sheet opened from the bar reads as a destination rather than a modal
          floating over a graph nobody asked to see. */}
      {screen !== "map" && (
        <div
          className="absolute inset-0 z-20 overflow-y-auto bg-[var(--paper)] pt-[var(--safe-top)] pb-[calc(68px+var(--safe-bottom))] sm:pt-14 sm:pb-10"
          data-testid={screen === "today" ? "today-screen" : "data-screen"}
        >
          {screen === "today" && (
          <Today
            data={data}
            onSelectNode={focusNode}
            onOpenPlanner={() => setPlannerOpen(true)}
            onOpenTab={openWorkbench}
            onRunProbe={setProbeId}
            onOpenMission={setMissionId}
            onOpenMap={() => setScreen("map")}
          />
          )}
        </div>
      )}

      <AppNav
        screen={screen}
        onChange={(next) => {
          if (next === "data") setReturnScreen(screen);
          setScreen(next);
          setWorkbench(next === "data" ? "review" : null);
          // Opening the map on whatever the camera was last pointed at reads as
          // a broken screen; with nothing selected, show the whole thing.
          if (next === "map" && !selectedId) fitAll();
        }}
        badge={inboxCount}
      />

      <SidePanel
        data={data}
        node={selectedNode}
        category={selectedCategory}
        nodesById={nodesById}
        onClose={clearSelection}
        onSelectNode={focusNode}
        focusMode={focusMode}
        onFocusModeChange={setFocusModeAndFrame}
        onRunProbe={setProbeId}
        onOpenMission={setMissionId}
        onOpenCapstone={setCapstoneId}
        onOpenPath={showPath}
        researchMode={researchMode}
        onResearchModeChange={setResearchMode}
      />

      <SessionPlanner
        data={data}
        open={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        onSelectNode={focusNode}
        researchMode={researchMode}
      />

      <Workbench
        open={workbench !== null}
        tab={workbench ?? "review"}
        onTabChange={openWorkbench}
        onClose={closeWorkbench}
        onSelectNode={focusNode}
        onRunProbe={setProbeId}
        onOpenMission={setMissionId}
        selectedId={selectedId}
      />

      {/* Keyed by probe so switching probes remounts with fresh state rather
          than an effect having to reset five pieces of state on change. */}
      <DiagnosticRunner key={probeId ?? "none"} probeId={probeId} onClose={() => setProbeId(null)} />
      <MissionRunner
        missionId={missionId}
        onClose={() => setMissionId(null)}
        onSelectNode={(id) => {
          setMissionId(null);
          focusNode(id);
        }}
      />
      <CapstoneRunner
        capstoneId={capstoneId}
        onClose={() => setCapstoneId(null)}
        onSelectNode={(id) => {
          setCapstoneId(null);
          focusNode(id);
        }}
      />

      <Onboarding
        onSelectNode={focusNode}
        onOpenMap={() => setScreen("map")}
        onRunProbe={setProbeId}
      />
      <MigrationNotice />

      <CommandPalette
        data={data}
        selectedId={selectedId}
        onSelectNode={focusNode}
        onOpenWorkbench={openWorkbench}
        onOpenPlanner={() => setPlannerOpen(true)}
        onRunProbe={setProbeId}
        onOpenMission={setMissionId}
        onShowPath={showPath}
        onFitView={fitAll}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusModeAndFrame(!focusMode)}
        researchMode={researchMode}
        onToggleResearchMode={() => setResearchMode((value) => !value)}
      />
    </div>
  );
}

export default function NeuralGraph() {
  return (
    <ErrorBoundary>
      <ProgressProvider>
        <ReactFlowProvider>
          <Graph />
        </ReactFlowProvider>
      </ProgressProvider>
    </ErrorBoundary>
  );
}
