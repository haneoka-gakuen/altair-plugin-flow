export const FLOW_PANEL_CSS = String.raw`
.altair-flow-panel {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
}
.story-graph-node {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #fff;
  border: 1px solid #cbd4ec;
  border-radius: 7px;
  font-family: inherit;
  font-size: 12px;
}
.story-graph-node strong {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-weight: 500;
  margin-top: 5px;
}
.story-graph-node small {
  color: #929bb4;
  font-size: 10px;
}
.story-graph-node.choice,
.story-graph-node.condition {
  border-color: #b8a1df;
  background: #fbf8ff;
}
`;
