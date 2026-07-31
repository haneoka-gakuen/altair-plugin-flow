# Altair Flow

Builds visual story graphs and reports unreachable scenes, unresolved targets, and cycles.

```sh
pnpm add @haneoka/altair @haneoka/altair-plugin-flow
```

```ts
import { ALTAIR_STORY_FLOW_PROVIDER_ID, altairFlowPlugin } from "@haneoka/altair-plugin-flow";

await host.install(altairFlowPlugin);
const graph = await host.buildFlow(ALTAIR_STORY_FLOW_PROVIDER_ID, project);
```

The graph supports choices, jumps, branches, scene calls, returns, endings, and markers.

MPL-2.0.
