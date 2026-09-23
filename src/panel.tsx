import { useMemo, useSyncExternalStore } from "react";
import { mountReactEditor, useEditorWorkspace, useEditorTranslator } from "@haneoka/altair-ui-react";
import { authoredNodeLines, parseAltairSceneDocument, type AltairPanelContext } from "@haneoka/altair/documents";
import { FLOW_PANEL_CSS } from "./styles.js";
import { ReactFlow, Background, Controls, MiniMap, MarkerType } from "@xyflow/react";
import { buildStoryFlowGraph } from "./flow.js";
import type { StoryProject } from "@haneoka/altair/documents";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
export function StoryGraph({
  project,
  onSelect,
}: {
  project: StoryProject;
  onSelect: (sceneId: string, line: number, nodeId?: string) => void;
}) {
  const tr = useEditorTranslator();
  const { nodes, edges, graph } = useMemo(() => {
    const graph = buildStoryFlowGraph(project),
      layout = new dagre.graphlib.Graph();
    layout.setGraph({ rankdir: "TB", ranksep: 52, nodesep: 30 });
    layout.setDefaultEdgeLabel(() => ({}));
    graph.nodes.forEach((node) => layout.setNode(node.id, { width: 200, height: 70 }));
    graph.edges.forEach((edge) => layout.setEdge(edge.from, edge.to));
    dagre.layout(layout);
    const label = (node: (typeof graph.nodes)[number]) => {
      if (node.kind === "project-entry") return tr("Project start");
      if (node.kind === "project-exit") return tr("Project end");
      if (node.kind === "scene-entry") return tr("Scene start");
      if (node.kind === "scene-exit") return tr("Scene end");
      const command = project.scenes
        .find((scene) => scene.id === node.sceneId)
        ?.commands.find((command) => command.id === node.commandId);
      if (!command) return node.label;
      const authored = command.extensions.altairNode;
      const type = authored && typeof authored === "object" && !Array.isArray(authored) ? authored.type : undefined;
      let name: string | undefined;
      if (typeof type === "string" && type.includes(":")) {
        try {
          name = decodeURIComponent(type.slice(type.indexOf(":") + 1));
        } catch {}
      }
      const title = name ? tr(`command.${name}`, { defaultValue: name }) : node.label;
      const value = command.fields.text;
      const summary =
        typeof value === "string"
          ? value
          : value && typeof value === "object" && !Array.isArray(value)
            ? value[project.meta.locale ?? "und"]
            : undefined;
      return typeof summary === "string" && summary ? `${title} · ${summary}` : title;
    };
    return {
      graph,
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        position: {
          x: layout.node(node.id).x - 100,
          y: layout.node(node.id).y - 35,
        },
        data: {
          label: (
            <>
              {node.sceneName && <small>{node.sceneName}</small>}
              <strong title={label(node)}>{label(node)}</strong>
            </>
          ),
        },
        className: `story-graph-node ${node.kind}`,
        style: { width: 200, minHeight: 70, opacity: node.reachable ? 1 : 0.5 },
      })),
      edges: graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: edge.label ? tr(edge.label) : undefined,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    };
  }, [project, tr]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      minZoom={0.15}
      zoomOnDoubleClick={false}
      ariaLabelConfig={{
        "controls.ariaLabel": tr("Flowchart controls"),
        "controls.zoomIn.ariaLabel": tr("Zoom in"),
        "controls.zoomOut.ariaLabel": tr("Zoom out"),
        "controls.fitView.ariaLabel": tr("Fit to view"),
        "minimap.ariaLabel": tr("Flowchart overview"),
      }}
      nodesDraggable={false}
      nodesConnectable={false}
      onNodeDoubleClick={(_, node) => {
        const original = graph.nodes.find((n) => n.id === node.id);
        if (original?.sceneId) {
          const command = project.scenes
            .find((scene) => scene.id === original.sceneId)
            ?.commands.find((command) => command.id === original.commandId);
          const authored = command?.extensions.altairNode;
          const nodeId =
            authored && typeof authored === "object" && !Array.isArray(authored) && typeof authored.nodeId === "string"
              ? authored.nodeId
              : original.commandId;
          onSelect(original.sceneId, original.sourceLine ?? 1, nodeId);
        }
      }}
    >
      <Background gap={20} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}

function FlowPanel() {
  const workspace = useEditorWorkspace(),
    tr = useEditorTranslator();
  const snapshot = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const reveal = (sceneId: string, line: number, nodeId?: string) => {
    for (const document of workspace.getSnapshot().documents) {
      if (!/\.scene\.ya?ml$/iu.test(document.path)) continue;
      try {
        if (parseAltairSceneDocument(document.text).id !== sceneId) continue;
        const targetLine = nodeId ? (authoredNodeLines(document.text).get(nodeId) ?? line) : line;
        workspace.activate(document.path, targetLine);
        workspace.select(targetLine);
        workspace.setView("visual");
        return;
      } catch {}
    }
  };
  return (
    <section className="altair-flow-panel">
      <style>{FLOW_PANEL_CSS}</style>
      {snapshot.project ? (
        <StoryGraph project={snapshot.project} onSelect={reveal} />
      ) : (
        <p>{tr("Open a target scene first")}</p>
      )}
    </section>
  );
}
export const mountFlowPanel = (host: HTMLElement, context: AltairPanelContext) =>
  mountReactEditor(host, context, <FlowPanel />);
