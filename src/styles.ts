export const FLOW_PANEL_CSS = String.raw`
.altair-flow-panel {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  min-width: 0;
  --xy-background-color: var(--md-sys-color-surface);
  --xy-edge-stroke: var(--md-sys-color-outline);
  --xy-edge-label-color: var(--md-sys-color-on-surface);
  --xy-edge-label-background-color: var(--md-sys-color-surface-container);
  --xy-minimap-background-color: var(--md-sys-color-surface-container);
  --xy-controls-button-background-color: var(--md-sys-color-surface-container-high);
  --xy-controls-button-background-color-hover: var(--md-sys-color-secondary-container);
  --xy-controls-button-color: var(--md-sys-color-on-surface);
  --xy-controls-button-color-hover: var(--md-sys-color-on-secondary-container);
  --xy-controls-button-border-color: var(--md-sys-color-outline-variant);
}
.altair-flow-panel .story-graph-node {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-large);
  font-family: var(--app-font);
  font-size: var(--md-sys-typescale-body-medium-size);
}
.altair-flow-panel .story-graph-node strong {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-weight: var(--md-sys-typescale-label-large-weight);
  margin-top: 5px;
}
.altair-flow-panel .story-graph-node small {
  color: var(--md-sys-color-on-surface-variant);
  font-size: var(--md-sys-typescale-label-medium-size);
}
.altair-flow-panel .story-graph-node.choice,
.altair-flow-panel .story-graph-node.condition {
  border-color: var(--md-sys-color-primary);
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
.altair-flow-panel .story-graph-node.selected { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
.altair-flow-panel .react-flow__controls { border-radius: var(--md-sys-shape-corner-full); background: var(--md-sys-color-surface-container-high); padding: var(--md-sys-spacing-1); }
.altair-flow-panel .react-flow__controls-button { width: 48px; height: 48px; min-height: 48px; border-radius: var(--md-sys-shape-corner-full); }
.altair-flow-panel .react-flow__controls-button svg { width: 24px; height: 24px; max-width: none; max-height: none; }
.altair-flow-panel .story-graph-node:is(.choice, .condition) small { color: inherit; }
`;
