# Altair Flow

Altair Flow turns a story project into a control-flow graph and draws it as a
flowchart inside Altair. Every scene, choice, jump, scene call and ending
becomes a node you can click to land on the command that produced it, and the
same pass reports the problems that are easy to miss in a long script: scenes
nobody reaches, jumps to labels that do not exist, labels defined twice, and
loops with no way out.

The graph is plain data. You can render it in Altair, feed it to your own
tooling, or check it in CI before a release.

It is part of the [Altair](https://github.com/haneoka-gakuen/altair) editor
suite and ships in
[`@haneoka/altair-preset-full`](https://github.com/haneoka-gakuen/altair-preset-full).

## Install

```sh
pnpm add @haneoka/altair @haneoka/altair-plugin-flow
```

The package is ESM only and needs Node 20 or a current browser.

## Use it in Altair

Install the plugin into the plugin host before opening a project:

```ts
import { AltairPluginHost } from "@haneoka/altair/plugins";
import { altairFlowPlugin } from "@haneoka/altair-plugin-flow";

const host = new AltairPluginHost();
await host.install(altairFlowPlugin);
```

The plugin contributes two things:

| Contribution | ID | What it does |
| --- | --- | --- |
| Workspace panel | `flowchart` | The flowchart view. Nodes are laid out top to bottom; clicking one selects its scene and source line in the editor. |
| Flow provider | `story-flow` | Builds the graph. It is registered on the singleton port `altair.flow.default`, so other plugins ask for "the" flow graph without knowing which provider supplies it. |

To build the graph from host code, ask the host for the provider:

```ts
import { ALTAIR_STORY_FLOW_PROVIDER_ID } from "@haneoka/altair-plugin-flow";

const graph = await host.buildFlow(ALTAIR_STORY_FLOW_PROVIDER_ID, project, signal);
```

`buildFlow` validates the project, hands the provider an immutable snapshot and
honours the abort signal before and after the build.

## Use it without the editor

The analysis has no dependency on the editor UI. Call it directly on a project:

```ts
import { buildStoryFlowGraph } from "@haneoka/altair-plugin-flow";

const graph = buildStoryFlowGraph(project);
const errors = graph.diagnostics.filter((d) => d.severity === "error");
if (errors.length) {
  for (const error of errors) console.error(`${error.path}: ${error.message}`);
  process.exit(1);
}
```

For a Vega project (the format Vega plays and Deneb packages), use
`buildVegaProjectFlowGraph(vegaProject)`. It reads Vega's own system opcodes
for jumps, calls and returns and produces the same graph shape.

## How the graph is built

The project starts at a `project-entry` node and ends at `project-exit`. Each
scene gets a `scene-entry` and `scene-exit`, with one node per command in
between. Commands that change control flow get their own node kinds:

| Node kind | Produced by |
| --- | --- |
| `choice` | A choice command. One `choice` edge per option, labelled with the option text. |
| `jump` | A jump to another scene, or to a label or command inside one. |
| `scene-call` | A call into another scene that comes back when that scene returns. |
| `scene-return` | Returning from a called scene to the command after the call. |
| `condition` | A branch on an expression, with a `whenTrue` and `whenFalse` target. |
| `end` | An ending command. |
| `scene-marker` | A label you can jump to. |
| `unresolved` | A target that could not be found. Edges still point here so the gap is visible. |
| `command` | Every other command, linked to the next one with a `next` edge. |

Edges are `entry`, `next`, `exit`, `jump`, `choice`, `scene-call` and
`scene-return`. A conditional jump or call carries a `condition` with the
expression and the outcome that takes the edge. Each node also records
`reachable`, its scene, the command id and index, the opcode or command type,
and the source line when the importer kept one.

### Where flow comes from

Altair reads control flow from three places, in this order:

1. An explicit directive stored on the command under the `altair:flow`
   extension key. This is the canonical form and wins over everything else.
2. Vega system opcodes for jump, call and return.
3. WebGAL scripts imported by
   [`altair-plugin-webgal`](https://github.com/haneoka-gakuen/altair-plugin-webgal):
   `callScene` becomes a scene call and `changeScene` becomes a jump, keeping
   any `-when=` condition.

To set a directive from your own importer or tool, use the helpers. They never
mutate the command you pass in:

```ts
import { storyFlowDirective, withStoryFlowDirective } from "@haneoka/altair-plugin-flow";

const next = withStoryFlowDirective(command, {
  kind: "jump",
  target: { sceneId: "chapter-2", label: "rooftop" },
  condition: "trust >= 3",
});

storyFlowDirective(next); // { kind: "jump", target: { … }, condition: "trust >= 3" }
```

A directive is one of:

- `{ kind: "jump", target, condition? }`
- `{ kind: "scene-call", target, condition? }`
- `{ kind: "scene-return", condition? }`
- `{ kind: "condition", expression, whenTrue?, whenFalse? }`

A target names a `sceneId` and optionally a `label` or `commandId` inside it.

## Diagnostics

`graph.diagnostics` lists everything the pass found. Each entry has a
`severity`, a stable `code`, a `path` into the project, a readable `message`
and the ids of the nodes involved, so a UI can highlight them.

| Code | Meaning |
| --- | --- |
| `flow.directive.invalid` | A command carries an `altair:flow` value that is not a valid directive. |
| `flow.scene.missing` | A jump or call names a scene that does not exist. |
| `flow.scene.ambiguous` | A target matches more than one scene. |
| `flow.command.missing` | A target names a command id that is not in the scene. |
| `flow.label.missing` | A target names a label that is not defined. |
| `flow.label.duplicate` | The same label is defined twice in one scene. |
| `flow.cycle` | A loop that never reaches an exit or an ending. |
| `flow.scene.unreachable` | No path from the project start reaches this scene. |

## API

| Export | Description |
| --- | --- |
| `altairFlowPlugin` (default export) | The plugin. Manifest id `haneoka.altair-flow`, capabilities `flow` and `panel`. |
| `altairStoryFlowProvider` | The flow provider on its own, for hosts that register contributions manually. |
| `ALTAIR_STORY_FLOW_PROVIDER_ID` | `"story-flow"` |
| `ALTAIR_STORY_FLOW_PORT` | `"altair.flow.default"` |
| `buildStoryFlowGraph(project)` | Builds a `StoryFlowGraph` from an Altair `StoryProject`. |
| `buildVegaProjectFlowGraph(project)` | Builds the same graph from a `VegaProject`. |
| `storyFlowDirective(command)` | Reads the directive stored on a command, if any. |
| `withStoryFlowDirective(command, directive)` | Returns a copy of the command with the directive attached. |
| `STORY_FLOW_EXTENSION_KEY` | `"altair:flow"` |

All graph, node, edge, directive and diagnostic types are exported with the
same names used above (`StoryFlowGraph`, `StoryFlowNode`, `StoryFlowEdge`,
`StoryFlowDirective`, `StoryFlowDiagnostic`, …).

## License

MPL-2.0. See [LICENSE](LICENSE).
