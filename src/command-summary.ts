import type {
  JsonValue,
  StoryProjectCommand,
} from "@haneoka/altair/model";

interface CommandSummaryDescriptor {
  readonly label: string;
  readonly fieldPaths: readonly string[];
}

/**
 * User-facing labels and ordered summary fields are maintained by the flow
 * plugin so graph construction never reaches into Altair's command
 * implementation. Values cover every currently defined immutable ADV opcode
 * plus command groups.
 */
const COMMAND_SUMMARY_ROWS = [
  [
    0,
    "Character in",
    [
      "targetName",
      "positionType",
      "characterWorldPosition",
      "duration",
      "noWait"
    ]
  ],
  [
    1,
    "Character out",
    [
      "targetName",
      "characterWorldPosition",
      "duration",
      "noWait"
    ]
  ],
  [
    2,
    "Talk",
    [
      "text",
      "targetName",
      "targetTextNames",
      "targetStatus",
      "voiceRefs",
      "ignoreLipSync",
      "params.0",
      "params.1",
      "hideTalkOnComplete",
      "noWait"
    ]
  ],
  [
    3,
    "Delay",
    [
      "duration",
      "key"
    ]
  ],
  [
    4,
    "Screen shake",
    [
      "canvasLayers",
      "params.0",
      "duration",
      "noWait"
    ]
  ],
  [
    5,
    "Fade out",
    [
      "targetAssetName",
      "params.0",
      "params.1",
      "duration",
      "noWait"
    ]
  ],
  [
    6,
    "Fade in",
    [
      "targetAssetName",
      "params.0",
      "params.1",
      "duration",
      "noWait"
    ]
  ],
  [
    7,
    "Focus",
    [
      "targetName",
      "positionType",
      "cameraDistance",
      "duration",
      "params.1",
      "delaySeconds",
      "noWait"
    ]
  ],
  [
    9,
    "Bring stage position forward",
    [
      "positionType"
    ]
  ],
  [
    10,
    "Send stage position backward",
    [
      "positionType"
    ]
  ],
  [
    11,
    "Flash",
    [
      "duration",
      "noWait"
    ]
  ],
  [
    12,
    "Brightness",
    [
      "targetName",
      "positionType",
      "canvasLayers",
      "params.0",
      "duration",
      "noWait"
    ]
  ],
  [
    13,
    "Move right",
    [
      "positionType",
      "params.0",
      "duration",
      "noWait"
    ]
  ],
  [
    14,
    "Move left",
    [
      "positionType",
      "params.0",
      "duration",
      "noWait"
    ]
  ],
  [
    15,
    "BGM",
    [
      "bgmRef",
      "params.0",
      "params.1",
      "duration",
      "params.2"
    ]
  ],
  [
    16,
    "Sound volume",
    [
      "params.0",
      "params.1",
      "duration",
      "noWait"
    ]
  ],
  [
    17,
    "Expression",
    [
      "expressionName",
      "targetName",
      "motionFadeIn"
    ]
  ],
  [
    18,
    "Pause character",
    [
      "targetName"
    ]
  ],
  [
    19,
    "Resume character",
    [
      "targetName"
    ]
  ],
  [
    20,
    "Location",
    [
      "text",
      "noWait"
    ]
  ],
  [
    21,
    "Motion",
    [
      "motionName",
      "targetName",
      "expressionName",
      "motionFadeIn",
      "motionWait"
    ]
  ],
  [
    23,
    "Load character model",
    [
      "live2dKey",
      "targetName",
      "targetAssetIndex"
    ]
  ],
  [
    24,
    "Costume",
    [
      "targetName",
      "targetAssetIndex"
    ]
  ],
  [
    25,
    "Background",
    [
      "backgroundRef",
      "duration",
      "noWait"
    ]
  ],
  [
    26,
    "Movie",
    [
      "videoRef",
      "params.0",
      "params.1"
    ]
  ],
  [
    27,
    "Clip",
    [
      "videoRef",
      "params.0",
      "params.1",
      "params.2"
    ]
  ],
  [
    28,
    "Video subtitles",
    [
      "text",
      "noWait"
    ]
  ],
  [
    29,
    "Wait for input",
    []
  ],
  [
    30,
    "Still",
    [
      "stillRef",
      "params.0",
      "params.1",
      "params.2",
      "params.3",
      "noWait"
    ]
  ],
  [
    31,
    "Sound effect",
    [
      "seRef",
      "params.0",
      "params.1",
      "params.2",
      "duration",
      "delaySeconds"
    ]
  ],
  [
    32,
    "Character angle",
    [
      "targetName",
      "params.0",
      "params.1",
      "duration",
      "delaySeconds",
      "noWait"
    ]
  ],
  [
    33,
    "Camera pan",
    [
      "params.0",
      "params.1",
      "duration",
      "noWait"
    ]
  ],
  [
    34,
    "Camera tilt",
    [
      "params.0",
      "params.1",
      "duration",
      "noWait"
    ]
  ],
  [
    35,
    "Talk window",
    [
      "talkWindow"
    ]
  ],
  [
    36,
    "Chat window",
    [
      "chatPresetRef",
      "targetName",
      "targetTextNames",
      "params.0",
      "params.1",
      "params.2",
      "noWait"
    ]
  ],
  [
    37,
    "Chat message",
    [
      "text",
      "chatPresetRef",
      "targetTextNames",
      "params.0",
      "params.2",
      "voiceRefs",
      "noWait"
    ]
  ],
  [
    38,
    "Chat stamp",
    [
      "targetAssetName",
      "chatPresetRef",
      "targetTextNames",
      "params.0",
      "params.2",
      "noWait"
    ]
  ],
  [
    39,
    "Chat read",
    [
      "chatPresetRef",
      "params.0",
      "params.2",
      "noWait"
    ]
  ],
  [
    40,
    "Retired choice no-op",
    []
  ],
  [
    41,
    "Show choices",
    [
      "choices",
      "advId",
      "params.0"
    ]
  ],
  [
    42,
    "Go to",
    [
      "params.0"
    ]
  ],
  [
    43,
    "Post effect",
    [
      "postEffectRef",
      "params.0"
    ]
  ],
  [
    44,
    "Frame",
    [
      "frameRef",
      "frameName",
      "params.0",
      "params.1",
      "delaySeconds",
      "noWait"
    ]
  ],
  [
    45,
    "Timeline",
    [
      "targetAssetName",
      "noWait"
    ]
  ],
  [
    46,
    "Look",
    [
      "targetName",
      "params.0",
      "params.1",
      "params.2",
      "duration",
      "delaySeconds",
      "noWait"
    ]
  ],
  [
    47,
    "Camera pedestal",
    [
      "params.0",
      "params.1",
      "duration",
      "delaySeconds",
      "noWait"
    ]
  ],
  [
    48,
    "Camera track",
    [
      "params.0",
      "params.1",
      "duration",
      "noWait"
    ]
  ],
  [
    49,
    "Depth of field",
    [
      "canvasLayers",
      "targetName",
      "positionType",
      "params.0",
      "params.1",
      "duration",
      "delaySeconds",
      "noWait"
    ]
  ],
  [
    50,
    "Camera roll",
    [
      "params.0",
      "params.1",
      "duration",
      "delaySeconds",
      "noWait"
    ]
  ],
  [
    51,
    "Camera shake",
    [
      "params.0",
      "params.1",
      "noWait"
    ]
  ],
  [
    52,
    "Voice",
    [
      "voiceRefs"
    ]
  ],
  [
    53,
    "Camera zoom",
    [
      "params.0",
      "params.1",
      "params.2",
      "duration",
      "delaySeconds",
      "noWait"
    ]
  ],
  [
    54,
    "ADV effect",
    [
      "effectRef",
      "targetName",
      "positionType",
      "canvasLayers",
      "params.0"
    ]
  ],
  [
    55,
    "Layer opacity",
    [
      "targetName",
      "canvasLayers",
      "params.0",
      "duration",
      "noWait"
    ]
  ],
  [
    56,
    "Force auto",
    []
  ],
  [
    57,
    "Stage environment",
    [
      "params.0",
      "params.1"
    ]
  ],
  [
    58,
    "Rim light",
    [
      "targetName",
      "params.0",
      "params.1"
    ]
  ],
  [
    59,
    "Cancel delay",
    []
  ],
  [
    60,
    "Move up",
    [
      "positionType",
      "params.0",
      "duration",
      "noWait"
    ]
  ],
  [
    61,
    "Move down",
    [
      "positionType",
      "params.0",
      "duration",
      "noWait"
    ]
  ],
  [
    62,
    "Move forward",
    [
      "positionType",
      "params.0",
      "duration",
      "noWait"
    ]
  ],
  [
    63,
    "Move back",
    [
      "positionType",
      "params.0",
      "duration",
      "noWait"
    ]
  ],
  [
    64,
    "Move direction",
    [
      "targetName",
      "positionType",
      "characterWorldPosition",
      "params.0",
      "params.1",
      "params.2",
      "duration",
      "noWait"
    ]
  ],
  [
    65,
    "Chat typing",
    [
      "text",
      "noWait"
    ]
  ],
  [
    66,
    "Look target",
    [
      "targetName",
      "positionType",
      "params.2",
      "duration",
      "delaySeconds",
      "noWait"
    ]
  ],
  [
    67,
    "Field pan",
    [
      "params.0",
      "params.1",
      "params.2",
      "duration",
      "delaySeconds",
      "noWait"
    ]
  ],
  [
    500,
    "Command group",
    []
  ]
] as const;

const COMMAND_SUMMARY_BY_OPCODE: ReadonlyMap<number, CommandSummaryDescriptor> =
  new Map(
    COMMAND_SUMMARY_ROWS.map(([opcode, label, fieldPaths]) => [
      opcode,
      { label, fieldPaths },
    ]),
  );

const fieldValue = (
  command: StoryProjectCommand,
  path: string,
): JsonValue | undefined => {
  const [sourceKey, parameterIndex] = path.split(".");
  if (!sourceKey) return undefined;
  const value = command.fields[sourceKey];
  if (parameterIndex === undefined) return value;
  if (!Array.isArray(value)) return undefined;
  return value[Number(parameterIndex)];
};

const displayValue = (value: JsonValue | undefined): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const localizedValue = value.find(
      (item) => typeof item === "string" && item.trim(),
    );
    if (typeof localizedValue === "string") return localizedValue;
    return value.length ? JSON.stringify(value) : "";
  }
  return value ? JSON.stringify(value) : "";
};

export const summarizeFlowCommand = (
  command: StoryProjectCommand,
): string => {
  const descriptor =
    command.command === null
      ? undefined
      : COMMAND_SUMMARY_BY_OPCODE.get(command.command);
  if (!descriptor) {
    return command.source?.command ?? `Command ${command.command ?? "?"}`;
  }
  for (const path of descriptor.fieldPaths) {
    const value = displayValue(fieldValue(command, path));
    if (value) return `${descriptor.label} · ${value}`;
  }
  return descriptor.label;
};
