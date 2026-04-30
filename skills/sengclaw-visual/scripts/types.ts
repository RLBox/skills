export type Provider =
  | "google"
  | "openai"
  | "openrouter"
  | "dashscope"
  | "minimax"
  | "replicate"
  | "jimeng"
  | "seedream"
  | "azure";
export type Quality = "normal" | "2k";

export type CliArgs = {
  prompt: string | null;
  promptFiles: string[];
  imagePath: string | null;
  provider: Provider | null;
  model: string | null;
  aspectRatio: string | null;
  size: string | null;
  quality: Quality | null;
  imageSize: string | null;
  referenceImages: string[];
  n: number;
  batchFile: string | null;
  jobs: number | null;
  json: boolean;
  help: boolean;
};

export type BatchTaskInput = {
  id?: string;
  prompt?: string | null;
  promptFiles?: string[];
  image?: string;
  provider?: Provider | null;
  model?: string | null;
  ar?: string | null;
  size?: string | null;
  quality?: Quality | null;
  imageSize?: "1K" | "2K" | "4K" | null;
  ref?: string[];
  n?: number;
};

export type BatchFile =
  | BatchTaskInput[]
  | {
      tasks: BatchTaskInput[];
      jobs?: number | null;
    };

export type WatermarkConfig = {
  // The watermark text to overlay (e.g., "@大胜龙虾")
  text: string | null;
  // Per-scene overrides: key is scene name (e.g., "xhs"), value is text or false to disable
  scene_overrides?: Record<string, string | false | null>;
};

export type ExtendConfig = {
  version: number;
  default_provider: Provider | null;
  default_quality: Quality | null;
  default_aspect_ratio: string | null;
  default_image_size: "1K" | "2K" | "4K" | null;
  default_model: {
    google: string | null;
    openai: string | null;
    openrouter: string | null;
    dashscope: string | null;
    minimax: string | null;
    replicate: string | null;
    jimeng: string | null;
    seedream: string | null;
    azure: string | null;
  };
  watermark?: WatermarkConfig | null;
  default_scene?: string | null;
  prompt_forbidden?: string | null;
  batch?: {
    max_workers?: number | null;
    provider_limits?: Partial<
      Record<
        Provider,
        {
          concurrency?: number | null;
          start_interval_ms?: number | null;
        }
      >
    >;
  };
};
