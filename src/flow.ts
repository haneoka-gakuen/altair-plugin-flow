import {
  VEGA_ADV_OPCODE,
  VEGA_SYSTEM_OPCODE,
  type VegaProject,
} from "@haneoka/vega-protocol";
import type {
  JsonValue,
  StoryProject,
  StoryProjectCommand,
  StoryScene,
} from "@haneoka/altair/model";
import { summarizeFlowCommand } from "./command-summary.js";

export const STORY_FLOW_EXTENSION_KEY = "altair:flow" as const;

export interface StoryFlowTarget {
  readonly sceneId?: string;
  readonly commandId?: string;
  readonly label?: string;
}

interface StoryFlowConditionalDirective {
  readonly condition?: string;
}

export type StoryFlowDirective =
  | ({
      readonly kind: "scene-call";
      readonly target: StoryFlowTarget;
    } & StoryFlowConditionalDirective)
  | ({
      readonly kind: "jump";
      readonly target: StoryFlowTarget;
    } & StoryFlowConditionalDirective)
  | ({
      readonly kind: "scene-return";
    } & StoryFlowConditionalDirective)
  | {
      readonly kind: "condition";
      readonly expression: string;
      readonly whenTrue?: StoryFlowTarget;
      readonly whenFalse?: StoryFlowTarget;
    };

export type StoryFlowNodeKind =
  | "project-entry"
  | "project-exit"
  | "scene-entry"
  | "scene-exit"
  | "command"
  | "choice"
  | "jump"
  | "scene-call"
  | "scene-return"
  | "condition"
  | "end"
  | "scene-marker"
  | "unresolved";

export interface StoryFlowNode {
  readonly id: string;
  readonly kind: StoryFlowNodeKind;
  readonly label: string;
  readonly reachable: boolean;
  readonly sceneId?: string;
  readonly sceneName?: string;
  readonly commandId?: string;
  readonly commandIndex?: number;
  readonly opcode?: number | null;
  readonly sourceLine?: number;
  readonly condition?: string;
}

export interface StoryFlowConditionBranch {
  readonly expression: string;
  readonly outcome: boolean;
}

interface StoryFlowEdgeBase {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly condition?: StoryFlowConditionBranch;
}

export interface StoryFlowEntryEdge extends StoryFlowEdgeBase {
  readonly kind: "entry";
}

export interface StoryFlowNextEdge extends StoryFlowEdgeBase {
  readonly kind: "next";
}

export interface StoryFlowExitEdge extends StoryFlowEdgeBase {
  readonly kind: "exit";
}

export interface StoryFlowJumpEdge extends StoryFlowEdgeBase {
  readonly kind: "jump";
  readonly targetSceneId: string;
  readonly targetLabel?: string;
}

export interface StoryFlowChoiceEdge extends StoryFlowEdgeBase {
  readonly kind: "choice";
  readonly choiceIndex: number;
  readonly choiceText: string;
}

export interface StoryFlowSceneCallEdge extends StoryFlowEdgeBase {
  readonly kind: "scene-call";
  readonly targetSceneId: string;
}

export interface StoryFlowSceneReturnEdge extends StoryFlowEdgeBase {
  readonly kind: "scene-return";
  readonly fromSceneId: string;
  readonly callCommandId: string;
}

export type StoryFlowEdge =
  | StoryFlowEntryEdge
  | StoryFlowNextEdge
  | StoryFlowExitEdge
  | StoryFlowJumpEdge
  | StoryFlowChoiceEdge
  | StoryFlowSceneCallEdge
  | StoryFlowSceneReturnEdge;

export type StoryFlowDiagnosticSeverity = "info" | "warning" | "error";

export interface StoryFlowDiagnostic {
  readonly severity: StoryFlowDiagnosticSeverity;
  readonly code:
    | "flow.directive.invalid"
    | "flow.scene.missing"
    | "flow.scene.ambiguous"
    | "flow.command.missing"
    | "flow.label.missing"
    | "flow.label.duplicate"
    | "flow.cycle"
    | "flow.scene.unreachable";
  readonly path: string;
  readonly message: string;
  readonly nodeIds: readonly string[];
}

export interface StoryFlowGraph {
  readonly entryNodeId: string;
  readonly exitNodeId: string;
  readonly nodes: readonly StoryFlowNode[];
  readonly edges: readonly StoryFlowEdge[];
  readonly diagnostics: readonly StoryFlowDiagnostic[];
}

type StoryFlowEdgeInput = StoryFlowEdge extends infer Edge
  ? Edge extends StoryFlowEdge
    ? Omit<Edge, "id">
    : never
  : never;

interface ResolvedTarget {
  readonly nodeId: string;
  readonly sceneId: string;
  readonly label?: string;
  readonly unresolved: boolean;
}

interface CallSite {
  readonly targetSceneId: string;
  readonly callCommandId: string;
  readonly returnNodeId: string;
}

const PROJECT_ENTRY_NODE_ID = "project/entry";
const PROJECT_EXIT_NODE_ID = "project/exit";

const nodePart = (value: string): string => encodeURIComponent(value);
const sceneEntryNodeId = (sceneId: string): string => `scene/${nodePart(sceneId)}/entry`;
const sceneExitNodeId = (sceneId: string): string => `scene/${nodePart(sceneId)}/exit`;
const commandNodeId = (sceneId: string, commandId: string): string =>
  `scene/${nodePart(sceneId)}/command/${nodePart(commandId)}`;

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const conditionFromSource = (command: StoryProjectCommand): string | undefined => {
  const canonical = nonEmptyString(command.fields.condition);
  if (canonical) return canonical;
  const args = command.source?.arguments;
  if (!args) return undefined;
  const entry = Object.entries(args).find(([key]) => key.toLowerCase() === "when");
  return nonEmptyString(entry?.[1]);
};

const systemTarget = (
  command: StoryProjectCommand,
  keyField: "thenKey" | "elseKey",
  sceneField: "thenScene" | "elseScene",
): StoryFlowTarget | undefined => {
  const key = nonEmptyString(command.fields[keyField]);
  if (key) return { label: key };
  const sceneId = nonEmptyString(command.fields[sceneField]);
  return sceneId ? { sceneId } : undefined;
};

const systemDirective = (command: StoryProjectCommand): StoryFlowDirective | undefined => {
  const condition = conditionFromSource(command);
  switch (command.command) {
    case VEGA_SYSTEM_OPCODE.Branch:
      return {
        kind: "condition",
        expression: condition ?? "(missing condition)",
        ...(systemTarget(command, "thenKey", "thenScene")
          ? { whenTrue: systemTarget(command, "thenKey", "thenScene")! }
          : {}),
        ...(systemTarget(command, "elseKey", "elseScene")
          ? { whenFalse: systemTarget(command, "elseKey", "elseScene")! }
          : {}),
      };
    case VEGA_SYSTEM_OPCODE.JumpScene:
    case VEGA_SYSTEM_OPCODE.CallScene:
      return {
        kind:
          command.command === VEGA_SYSTEM_OPCODE.CallScene
            ? "scene-call"
            : "jump",
        target: { sceneId: nonEmptyString(command.fields.sceneId) ?? "(empty)" },
        ...(condition ? { condition } : {}),
      };
    case VEGA_SYSTEM_OPCODE.ReturnScene:
      return {
        kind: "scene-return",
        ...(condition ? { condition } : {}),
      };
    default:
      return undefined;
  }
};

const targetFromValue = (value: unknown): StoryFlowTarget | undefined => {
  if (!record(value)) return undefined;
  const sceneId = nonEmptyString(value.sceneId);
  const commandId = nonEmptyString(value.commandId);
  const label = nonEmptyString(value.label);
  if (!sceneId && !commandId && !label) return undefined;
  return {
    ...(sceneId ? { sceneId } : {}),
    ...(commandId ? { commandId } : {}),
    ...(label ? { label } : {}),
  };
};

const directiveFromValue = (value: unknown): StoryFlowDirective | undefined => {
  if (!record(value)) return undefined;
  const condition = nonEmptyString(value.condition);
  switch (value.kind) {
    case "scene-call":
    case "jump": {
      const target = targetFromValue(value.target);
      if (!target) return undefined;
      return {
        kind: value.kind,
        target,
        ...(condition ? { condition } : {}),
      };
    }
    case "scene-return":
      return {
        kind: "scene-return",
        ...(condition ? { condition } : {}),
      };
    case "condition": {
      const expression = nonEmptyString(value.expression);
      if (!expression) return undefined;
      const whenTrue = targetFromValue(value.whenTrue);
      const whenFalse = targetFromValue(value.whenFalse);
      return {
        kind: "condition",
        expression,
        ...(whenTrue ? { whenTrue } : {}),
        ...(whenFalse ? { whenFalse } : {}),
      };
    }
    default:
      return undefined;
  }
};

/** Read the canonical authoring directive carried by a command extension. */
export const storyFlowDirective = (command: StoryProjectCommand): StoryFlowDirective | undefined =>
  directiveFromValue(command.extensions[STORY_FLOW_EXTENSION_KEY]);

/** Attach a canonical flow directive without mutating the source command. */
export const withStoryFlowDirective = (
  command: StoryProjectCommand,
  directive: StoryFlowDirective,
): StoryProjectCommand => ({
  ...cloneFlowValue(command),
  extensions: {
    ...cloneFlowValue(command.extensions),
    [STORY_FLOW_EXTENSION_KEY]: cloneFlowValue(directive) as unknown as JsonValue,
  },
});

const webGalDirective = (command: StoryProjectCommand): StoryFlowDirective | undefined => {
  const opaque = record(command.extensions.webgalOpaque) ? command.extensions.webgalOpaque : undefined;
  const sourceName = nonEmptyString(opaque?.name) ?? nonEmptyString(command.source?.command);
  const name = sourceName?.toLowerCase();
  const content = nonEmptyString(opaque?.content);
  const condition = conditionFromSource(command);
  if ((name === "callscene" || name === "changescene") && content) {
    return {
      kind: name === "callscene" ? "scene-call" : "jump",
      target: { sceneId: content },
      ...(condition ? { condition } : {}),
    };
  }
  return undefined;
};

const inferredDirective = (command: StoryProjectCommand): StoryFlowDirective | undefined =>
  storyFlowDirective(command) ?? systemDirective(command) ?? webGalDirective(command);

const targetSummary = (target: StoryFlowTarget): string =>
  [target.sceneId, target.label && `#${target.label}`, target.commandId && `@${target.commandId}`]
    .filter(Boolean)
    .join("") || "target";

const cloneFlowValue = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneFlowValue(entry)) as T;
  }
  if (record(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneFlowValue(entry)]),
    ) as T;
  }
  return value;
};

const assertFlowProject: (
  value: unknown,
) => asserts value is StoryProject = (value) => {
  if (!record(value) || value.version !== 2) {
    throw new TypeError("Unsupported Altair story project format");
  }
  if (!Array.isArray(value.scenes) || value.scenes.length === 0) {
    throw new TypeError("Altair story project must contain at least one scene");
  }
  const entrySceneId = nonEmptyString(value.entrySceneId);
  if (!entrySceneId) {
    throw new TypeError("Altair story project entrySceneId must not be empty");
  }
  const sceneIds = new Set<string>();
  for (const [sceneIndex, sceneValue] of value.scenes.entries()) {
    if (!record(sceneValue)) {
      throw new TypeError(`Altair scene ${sceneIndex} must be an object`);
    }
    const sceneId = nonEmptyString(sceneValue.id);
    if (!sceneId) {
      throw new TypeError(`Altair scene ${sceneIndex} must have an id`);
    }
    if (sceneIds.has(sceneId)) {
      throw new TypeError(`Altair scene id '${sceneId}' is duplicated`);
    }
    sceneIds.add(sceneId);
    if (!Array.isArray(sceneValue.commands)) {
      throw new TypeError(`Altair scene '${sceneId}' commands must be an array`);
    }
    if (!record(sceneValue.extensions)) {
      throw new TypeError(`Altair scene '${sceneId}' extensions must be an object`);
    }
    const commandIds = new Set<string>();
    for (const [commandIndex, commandValue] of sceneValue.commands.entries()) {
      if (!record(commandValue)) {
        throw new TypeError(
          `Altair command ${commandIndex} in scene '${sceneId}' must be an object`,
        );
      }
      const commandId = nonEmptyString(commandValue.id);
      if (!commandId) {
        throw new TypeError(
          `Altair command ${commandIndex} in scene '${sceneId}' must have an id`,
        );
      }
      if (commandIds.has(commandId)) {
        throw new TypeError(
          `Altair command id '${commandId}' is duplicated in scene '${sceneId}'`,
        );
      }
      commandIds.add(commandId);
      if (
        commandValue.command !== null &&
        (typeof commandValue.command !== "number" ||
          !Number.isSafeInteger(commandValue.command))
      ) {
        throw new TypeError(
          `Altair command '${commandId}' in scene '${sceneId}' has an invalid opcode`,
        );
      }
      if (!record(commandValue.fields) || !record(commandValue.extensions)) {
        throw new TypeError(
          `Altair command '${commandId}' in scene '${sceneId}' must contain JSON fields and extensions`,
        );
      }
    }
  }
  if (!sceneIds.has(entrySceneId)) {
    throw new TypeError(
      `Altair entry scene '${entrySceneId}' does not exist`,
    );
  }
};

const flowCommandLabel = (
  command: StoryProjectCommand,
  directive: StoryFlowDirective | undefined,
): string => {
  const label = nonEmptyString(command.fields.key);
  if (label) return `Label · ${label}`;
  if (directive?.kind === "scene-call") return `Call scene · ${targetSummary(directive.target)}`;
  if (directive?.kind === "scene-return") return "Return from scene";
  if (directive?.kind === "jump") return `Jump · ${targetSummary(directive.target)}`;
  if (directive?.kind === "condition") return `Condition · ${directive.expression}`;
  if (command.command === VEGA_SYSTEM_OPCODE.End) {
    return command.fields.returnIfCalled === true ? "End scene · return if called" : "End story";
  }
  if (command.command === VEGA_SYSTEM_OPCODE.SceneMarker) {
    return `Scene marker · ${nonEmptyString(command.fields.sceneId) ?? "(missing scene)"}`;
  }
  if (command.command === VEGA_ADV_OPCODE.ChoiceShow) {
    const choices = Array.isArray(command.fields.choices) ? command.fields.choices.length : 0;
    return `Choice · ${choices} option${choices === 1 ? "" : "s"}`;
  }
  return summarizeFlowCommand(command);
};

const normalizeSceneReference = (value: string): string =>
  value
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/\.(?:txt|wg|json|webgal)$/i, "")
    .toLowerCase();

const sceneReferenceCandidates = (scene: StoryScene): readonly string[] => {
  const values = [scene.id, scene.name];
  return [
    ...new Set(
      values.flatMap((value) => {
        const normalized = normalizeSceneReference(value);
        const basename = normalized.split("/").at(-1) ?? normalized;
        return [normalized, basename];
      }),
    ),
  ];
};

const displayChoiceText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string" && Boolean(item.trim())) ?? "";
  }
  if (record(value)) {
    return Object.values(value).find((item): item is string => typeof item === "string" && Boolean(item.trim())) ?? "";
  }
  return value === undefined || value === null ? "" : String(value);
};

const nodePath = (node: StoryFlowNode): string => {
  if (node.commandIndex !== undefined && node.sceneId) {
    return `$.scenes[${node.sceneId}].commands[${node.commandIndex}]`;
  }
  return node.sceneId ? `$.scenes[${node.sceneId}]` : "$";
};

/**
 * Build an executable-control-flow projection of every scene in a project.
 *
 * Native ChoiceShow/GoTo commands, canonical `altair:flow` directives and
 * preserved WebGAL callScene/changeScene statements share one graph. Missing
 * references become explicit unresolved nodes, so every edge remains total and
 * editor renderers never need to guess whether a target exists.
 */
export const buildStoryFlowGraph = (project: StoryProject): StoryFlowGraph => {
  assertFlowProject(project);

  const mutableNodes: StoryFlowNode[] = [
    { id: PROJECT_ENTRY_NODE_ID, kind: "project-entry", label: "Project start", reachable: false },
    { id: PROJECT_EXIT_NODE_ID, kind: "project-exit", label: "Project end", reachable: false },
  ];
  const edges: StoryFlowEdge[] = [];
  const diagnostics: StoryFlowDiagnostic[] = [];
  const nodeById = new Map<string, StoryFlowNode>();
  const labelsByScene = new Map<string, Map<string, string>>();
  const commandsByScene = new Map<string, Map<string, string>>();
  const sceneById = new Map(project.scenes.map((scene) => [scene.id, scene] as const));
  const callSites: CallSite[] = [];
  const jumpedScenes = new Set<string>();
  let edgeSequence = 0;

  const addNode = (node: StoryFlowNode): void => {
    mutableNodes.push(node);
    nodeById.set(node.id, node);
  };
  nodeById.set(PROJECT_ENTRY_NODE_ID, mutableNodes[0]!);
  nodeById.set(PROJECT_EXIT_NODE_ID, mutableNodes[1]!);
  const addEdge = (edge: StoryFlowEdgeInput): void => {
    edges.push({ id: `flow-edge-${++edgeSequence}`, ...edge } as StoryFlowEdge);
  };
  const addDiagnostic = (diagnostic: StoryFlowDiagnostic): void => {
    diagnostics.push(diagnostic);
  };

  for (const [sceneIndex, scene] of project.scenes.entries()) {
    addNode({
      id: sceneEntryNodeId(scene.id),
      kind: "scene-entry",
      label: `${scene.name || scene.id} · start`,
      reachable: false,
      sceneId: scene.id,
      sceneName: scene.name,
    });
    addNode({
      id: sceneExitNodeId(scene.id),
      kind: "scene-exit",
      label: `${scene.name || scene.id} · end`,
      reachable: false,
      sceneId: scene.id,
      sceneName: scene.name,
    });
    const labels = new Map<string, string>();
    const commands = new Map<string, string>();
    labelsByScene.set(scene.id, labels);
    commandsByScene.set(scene.id, commands);
    for (const [commandIndex, command] of scene.commands.entries()) {
      const directive = inferredDirective(command);
      const condition = directive?.kind === "condition" ? directive.expression : directive?.condition ?? conditionFromSource(command);
      const kind: StoryFlowNodeKind =
        command.command === VEGA_SYSTEM_OPCODE.End
          ? "end"
          : command.command === VEGA_SYSTEM_OPCODE.SceneMarker
            ? "scene-marker"
            : directive?.kind === "scene-call"
          ? "scene-call"
          : directive?.kind === "scene-return"
            ? "scene-return"
            : directive?.kind === "jump" || command.command === VEGA_ADV_OPCODE.GoTo
              ? "jump"
              : command.command === VEGA_ADV_OPCODE.ChoiceShow
                ? "choice"
                : condition
                  ? "condition"
                  : "command";
      const id = commandNodeId(scene.id, command.id);
      addNode({
        id,
        kind,
        label: flowCommandLabel(command, directive),
        reachable: false,
        sceneId: scene.id,
        sceneName: scene.name,
        commandId: command.id,
        commandIndex,
        opcode: command.command,
        ...(command.source?.line === undefined ? {} : { sourceLine: command.source.line }),
        ...(condition ? { condition } : {}),
      });
      commands.set(command.id, id);
      const label = nonEmptyString(command.fields.key);
      if (label) {
        const previous = labels.get(label);
        if (previous) {
          addDiagnostic({
            severity: "error",
            code: "flow.label.duplicate",
            path: `$.scenes[${sceneIndex}].commands[${commandIndex}].fields.key`,
            message: `Label '${label}' is declared more than once in scene '${scene.id}'`,
            nodeIds: [previous, id],
          });
        } else {
          labels.set(label, id);
        }
      }
      if (
        Object.hasOwn(command.extensions, STORY_FLOW_EXTENSION_KEY) &&
        !storyFlowDirective(command)
      ) {
        addDiagnostic({
          severity: "error",
          code: "flow.directive.invalid",
          path: `$.scenes[${sceneIndex}].commands[${commandIndex}].extensions.${STORY_FLOW_EXTENSION_KEY}`,
          message: "The altair:flow extension is not a valid typed flow directive",
          nodeIds: [id],
        });
      }
    }
  }

  const resolveScene = (
    reference: string,
    path: string,
    sourceNodeId: string,
  ): StoryScene | undefined => {
    const exact = sceneById.get(reference);
    if (exact) return exact;
    const normalized = normalizeSceneReference(reference);
    const referenceCandidates = [normalized, normalized.split("/").at(-1) ?? normalized];
    const matches = project.scenes.filter((scene) =>
      sceneReferenceCandidates(scene).some((candidate) => referenceCandidates.includes(candidate)),
    );
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      addDiagnostic({
        severity: "error",
        code: "flow.scene.ambiguous",
        path,
        message: `Scene reference '${reference}' matches ${matches.map((scene) => scene.id).join(", ")}`,
        nodeIds: [sourceNodeId],
      });
    }
    return undefined;
  };

  const unresolvedTarget = (
    reference: StoryFlowTarget,
    path: string,
    sourceNodeId: string,
    code: StoryFlowDiagnostic["code"],
    message: string,
    requestedSceneId: string,
  ): ResolvedTarget => {
    const id = `unresolved/${nodePart(`${path}|${JSON.stringify(reference)}`)}`;
    if (!nodeById.has(id)) {
      addNode({
        id,
        kind: "unresolved",
        label: message,
        reachable: false,
        ...(requestedSceneId ? { sceneId: requestedSceneId } : {}),
      });
    }
    addDiagnostic({
      severity: "error",
      code,
      path,
      message,
      nodeIds: [sourceNodeId, id],
    });
    return { nodeId: id, sceneId: requestedSceneId, unresolved: true };
  };

  const resolveTarget = (
    reference: StoryFlowTarget,
    currentSceneId: string,
    path: string,
    sourceNodeId: string,
  ): ResolvedTarget => {
    const requestedSceneId = reference.sceneId ?? currentSceneId;
    const scene = resolveScene(requestedSceneId, path, sourceNodeId);
    if (!scene) {
      return unresolvedTarget(
        reference,
        path,
        sourceNodeId,
        "flow.scene.missing",
        `Scene '${requestedSceneId}' does not exist`,
        requestedSceneId,
      );
    }
    if (reference.commandId) {
      const nodeId = commandsByScene.get(scene.id)?.get(reference.commandId);
      if (!nodeId) {
        return unresolvedTarget(
          reference,
          path,
          sourceNodeId,
          "flow.command.missing",
          `Command '${reference.commandId}' does not exist in scene '${scene.id}'`,
          scene.id,
        );
      }
      return { nodeId, sceneId: scene.id, unresolved: false };
    }
    if (reference.label) {
      const nodeId = labelsByScene.get(scene.id)?.get(reference.label);
      if (!nodeId) {
        return unresolvedTarget(
          reference,
          path,
          sourceNodeId,
          "flow.label.missing",
          `Label '${reference.label}' does not exist in scene '${scene.id}'`,
          scene.id,
        );
      }
      return { nodeId, sceneId: scene.id, label: reference.label, unresolved: false };
    }
    return { nodeId: sceneEntryNodeId(scene.id), sceneId: scene.id, unresolved: false };
  };

  addEdge({
    kind: "entry",
    from: PROJECT_ENTRY_NODE_ID,
    to: sceneEntryNodeId(project.entrySceneId),
    label: "entry scene",
  });

  for (const [sceneIndex, scene] of project.scenes.entries()) {
    const firstNodeId = scene.commands[0]
      ? commandNodeId(scene.id, scene.commands[0].id)
      : sceneExitNodeId(scene.id);
    addEdge({
      kind: "entry",
      from: sceneEntryNodeId(scene.id),
      to: firstNodeId,
    });

    for (const [commandIndex, command] of scene.commands.entries()) {
      const from = commandNodeId(scene.id, command.id);
      const successor = scene.commands[commandIndex + 1]
        ? commandNodeId(scene.id, scene.commands[commandIndex + 1]!.id)
        : sceneExitNodeId(scene.id);
      const path = `$.scenes[${sceneIndex}].commands[${commandIndex}]`;
      const directive = inferredDirective(command);
      const sourceCondition = conditionFromSource(command);
      const condition =
        directive?.kind === "condition" ? directive.expression : directive?.condition ?? sourceCondition;
      const branch = (outcome: boolean): StoryFlowConditionBranch | undefined =>
        condition ? { expression: condition, outcome } : undefined;
      const conditionalFallthrough = (): void => {
        if (!condition) return;
        addEdge({
          kind: "next",
          from,
          to: successor,
          label: "condition false",
          condition: { expression: condition, outcome: false },
        });
      };

      if (directive?.kind === "scene-call") {
        const target = resolveTarget(directive.target, scene.id, `${path}.extensions.${STORY_FLOW_EXTENSION_KEY}`, from);
        addEdge({
          kind: "scene-call",
          from,
          to: target.nodeId,
          targetSceneId: target.sceneId,
          label: "call",
          ...(branch(true) ? { condition: branch(true)! } : {}),
        });
        conditionalFallthrough();
        if (!target.unresolved) {
          callSites.push({
            targetSceneId: target.sceneId,
            callCommandId: command.id,
            returnNodeId: successor,
          });
        }
        continue;
      }

      if (directive?.kind === "scene-return") {
        addEdge({
          kind: "exit",
          from,
          to: sceneExitNodeId(scene.id),
          label: "return",
          ...(branch(true) ? { condition: branch(true)! } : {}),
        });
        conditionalFallthrough();
        continue;
      }

      if (directive?.kind === "jump") {
        const target = resolveTarget(directive.target, scene.id, `${path}.extensions.${STORY_FLOW_EXTENSION_KEY}`, from);
        addEdge({
          kind: "jump",
          from,
          to: target.nodeId,
          targetSceneId: target.sceneId,
          ...(target.label ? { targetLabel: target.label } : {}),
          label: target.label ? `jump · ${target.label}` : `scene · ${target.sceneId}`,
          ...(branch(true) ? { condition: branch(true)! } : {}),
        });
        if (target.sceneId !== scene.id && !target.unresolved) jumpedScenes.add(target.sceneId);
        conditionalFallthrough();
        continue;
      }

      if (directive?.kind === "condition") {
        const outcomes: ReadonlyArray<[boolean, StoryFlowTarget | undefined]> = [
          [true, directive.whenTrue],
          [false, directive.whenFalse],
        ];
        for (const [outcome, flowTarget] of outcomes) {
          const target = flowTarget
            ? resolveTarget(flowTarget, scene.id, `${path}.extensions.${STORY_FLOW_EXTENSION_KEY}`, from)
            : { nodeId: successor, sceneId: scene.id, unresolved: false };
          addEdge({
            kind: flowTarget ? "jump" : "next",
            from,
            to: target.nodeId,
            ...(flowTarget
              ? {
                  targetSceneId: target.sceneId,
                  ...(target.label ? { targetLabel: target.label } : {}),
                }
              : {}),
            label: outcome ? "condition true" : "condition false",
            condition: { expression: directive.expression, outcome },
          } as StoryFlowEdgeInput);
          if (flowTarget && target.sceneId !== scene.id && !target.unresolved) jumpedScenes.add(target.sceneId);
        }
        continue;
      }

      if (command.command === VEGA_SYSTEM_OPCODE.End) {
        addEdge({
          kind: "exit",
          from,
          to:
            command.fields.returnIfCalled === true
              ? sceneExitNodeId(scene.id)
              : PROJECT_EXIT_NODE_ID,
          label:
            command.fields.returnIfCalled === true
              ? "return if called"
              : "end story",
          ...(branch(true) ? { condition: branch(true)! } : {}),
        });
        conditionalFallthrough();
        continue;
      }

      if (command.command === VEGA_ADV_OPCODE.GoTo) {
        const params = Array.isArray(command.fields.params) ? command.fields.params : [];
        const label = nonEmptyString(params[0]);
        const target = resolveTarget(
          label ? { label } : { label: "(empty)" },
          scene.id,
          `${path}.fields.params[0]`,
          from,
        );
        addEdge({
          kind: "jump",
          from,
          to: target.nodeId,
          targetSceneId: target.sceneId,
          ...(label ? { targetLabel: label } : {}),
          label: label ? `jump · ${label}` : "jump",
          ...(branch(true) ? { condition: branch(true)! } : {}),
        });
        conditionalFallthrough();
        continue;
      }

      if (command.command === VEGA_ADV_OPCODE.ChoiceShow) {
        const choices = Array.isArray(command.fields.choices) ? command.fields.choices : [];
        for (const [choiceIndex, value] of choices.entries()) {
          if (!record(value)) continue;
          const flowTarget = targetFromValue(value.flowTarget);
          const nextKey = nonEmptyString(value.nextKey);
          const target = resolveTarget(
            flowTarget ?? (nextKey ? { label: nextKey } : { label: "(empty)" }),
            scene.id,
            `${path}.fields.choices[${choiceIndex}]`,
            from,
          );
          const choiceText = displayChoiceText(value.text) || `Choice ${choiceIndex + 1}`;
          addEdge({
            kind: "choice",
            from,
            to: target.nodeId,
            choiceIndex,
            choiceText,
            label: choiceText,
            ...(branch(true) ? { condition: branch(true)! } : {}),
          });
          if (target.sceneId !== scene.id && !target.unresolved) jumpedScenes.add(target.sceneId);
        }
        conditionalFallthrough();
        continue;
      }

      if (condition) {
        addEdge({
          kind: "next",
          from,
          to: successor,
          label: "condition true",
          condition: { expression: condition, outcome: true },
        });
        conditionalFallthrough();
      } else {
        addEdge({ kind: "next", from, to: successor });
      }
    }
  }

  for (const callSite of callSites) {
    addEdge({
      kind: "scene-return",
      from: sceneExitNodeId(callSite.targetSceneId),
      to: callSite.returnNodeId,
      fromSceneId: callSite.targetSceneId,
      callCommandId: callSite.callCommandId,
      label: "return",
    });
  }

  for (const scene of project.scenes) {
    const hasCallers = callSites.some(({ targetSceneId }) => targetSceneId === scene.id);
    if (scene.id === project.entrySceneId || jumpedScenes.has(scene.id) || !hasCallers) {
      addEdge({
        kind: "exit",
        from: sceneExitNodeId(scene.id),
        to: PROJECT_EXIT_NODE_ID,
        label: "story end",
      });
    }
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }
  const reachable = new Set<string>();
  const pending = [PROJECT_ENTRY_NODE_ID];
  while (pending.length) {
    const nodeId = pending.pop()!;
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    pending.push(...(adjacency.get(nodeId) ?? []));
  }

  for (const scene of project.scenes) {
    const entryId = sceneEntryNodeId(scene.id);
    if (!reachable.has(entryId)) {
      addDiagnostic({
        severity: "warning",
        code: "flow.scene.unreachable",
        path: `$.scenes[${project.scenes.indexOf(scene)}]`,
        message: `Scene '${scene.id}' is not reachable from entry scene '${project.entrySceneId}'`,
        nodeIds: [entryId],
      });
    }
  }

  const indexByNode = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const tarjanStack: string[] = [];
  const onStack = new Set<string>();
  let tarjanIndex = 0;
  const cycles: string[][] = [];
  const visit = (nodeId: string): void => {
    indexByNode.set(nodeId, tarjanIndex);
    lowLink.set(nodeId, tarjanIndex);
    tarjanIndex += 1;
    tarjanStack.push(nodeId);
    onStack.add(nodeId);
    for (const target of adjacency.get(nodeId) ?? []) {
      if (!indexByNode.has(target)) {
        visit(target);
        lowLink.set(nodeId, Math.min(lowLink.get(nodeId)!, lowLink.get(target)!));
      } else if (onStack.has(target)) {
        lowLink.set(nodeId, Math.min(lowLink.get(nodeId)!, indexByNode.get(target)!));
      }
    }
    if (lowLink.get(nodeId) !== indexByNode.get(nodeId)) return;
    const component: string[] = [];
    while (tarjanStack.length) {
      const item = tarjanStack.pop()!;
      onStack.delete(item);
      component.push(item);
      if (item === nodeId) break;
    }
    const selfLoop = component.length === 1 && (adjacency.get(component[0]!) ?? []).includes(component[0]!);
    if (component.length > 1 || selfLoop) cycles.push(component);
  };
  for (const node of mutableNodes) {
    if (!indexByNode.has(node.id)) visit(node.id);
  }
  for (const cycle of cycles) {
    const cycleNodes = cycle.map((id) => nodeById.get(id)).filter((node): node is StoryFlowNode => Boolean(node));
    addDiagnostic({
      severity: "warning",
      code: "flow.cycle",
      path: cycleNodes[0] ? nodePath(cycleNodes[0]) : "$",
      message: `Control-flow cycle: ${cycleNodes.map(({ label }) => label).join(" → ")}`,
      nodeIds: cycle,
    });
  }

  return {
    entryNodeId: PROJECT_ENTRY_NODE_ID,
    exitNodeId: PROJECT_EXIT_NODE_ID,
    nodes: mutableNodes.map((node) => ({ ...node, reachable: reachable.has(node.id) })),
    edges,
    diagnostics,
  };
};

/**
 * Analyse the exact authoring graph embedded by Altair's default VegaProject
 * compiler. A runtime-only VegaProject cannot recover editor-only call,
 * condition, or preserved-source directives and therefore fails explicitly.
 */
export const buildVegaProjectFlowGraph = (project: VegaProject): StoryFlowGraph => {
  if (project.format !== "vega-project" || project.formatVersion !== 1) {
    throw new TypeError("Unsupported Vega project format");
  }
  const source = project.metadata?.["altair:authoringSource"];
  if (!source) {
    throw new TypeError(
      "Vega project does not contain altair:authoringSource; full multi-scene control flow cannot be recovered",
    );
  }
  const restored = cloneFlowValue(source) as unknown;
  assertFlowProject(restored);
  return buildStoryFlowGraph(restored);
};
