import { defineAltairPlugin, type AltairFlowProviderContribution } from "@haneoka/altair/plugins";
import { buildStoryFlowGraph } from "./flow.js";

export * from "./flow.js";

export const ALTAIR_STORY_FLOW_PROVIDER_ID = "story-flow";
export const ALTAIR_STORY_FLOW_PORT = "altair.flow.default";

export const altairStoryFlowProvider = Object.freeze({
  id: ALTAIR_STORY_FLOW_PROVIDER_ID,
  name: "Altair Story Flow",
  build(project, context) {
    context.signal.throwIfAborted();
    const graph = buildStoryFlowGraph(project);
    context.signal.throwIfAborted();
    return graph;
  },
} satisfies AltairFlowProviderContribution);

export const altairFlowPlugin = defineAltairPlugin({
  manifest: {
    id: "haneoka.altair-flow",
    name: "Altair Flow",
    version: "0.1.0",
    apiVersion: 2,
    description: "Canonical control-flow analysis for Altair story projects",
    capabilities: ["flow", "panel"],
  },
  setup(context) {
    context.contribute("panel", {
      id: "flowchart",
      name: "Flowchart",
      slot: "workspace",
      async mount(host, panelContext) {
        const { mountFlowPanel } = await import("./panel.js");
        panelContext.signal.throwIfAborted();
        return mountFlowPanel(host, panelContext);
      },
    });
    context.contribute("flow", altairStoryFlowProvider, {
      singletonPort: ALTAIR_STORY_FLOW_PORT,
    });
  },
});

export default altairFlowPlugin;
