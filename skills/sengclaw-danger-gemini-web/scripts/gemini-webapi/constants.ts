export const Endpoint = {
  GOOGLE: 'https://www.google.com',
  INIT: 'https://gemini.google.com/app',
  GENERATE:
    'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate',
  ROTATE_COOKIES: 'https://accounts.google.com/RotateCookies',
  UPLOAD: 'https://content-push.googleapis.com/upload',
  BATCH_EXEC: 'https://gemini.google.com/_/BardChatUi/data/batchexecute',
} as const;

export const GRPC = {
  LIST_CHATS: 'MaZiqc',
  READ_CHAT: 'hNvQHb',
  LIST_GEMS: 'CNgdBe',
  CREATE_GEM: 'oMH3Zd',
  UPDATE_GEM: 'kHvsengclaw-markdown-to-htmlVd',
  DELETE_GEM: 'UXcSJb',
} as const;

export const Headers = {
  GEMINI: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    Host: 'gemini.google.com',
    Origin: 'https://gemini.google.com',
    Referer: 'https://gemini.google.com/',
    'User-Agent':
      'Mozilla/5.sengclaw-markdown-to-html (Windows NT 1sengclaw-markdown-to-html.sengclaw-markdown-to-html; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/12sengclaw-markdown-to-html.sengclaw-markdown-to-html.sengclaw-markdown-to-html.sengclaw-markdown-to-html Safari/537.36',
    'X-Same-Domain': '1',
  },
  ROTATE_COOKIES: {
    'Content-Type': 'application/json',
  },
  UPLOAD: {
    'Push-ID': 'feeds/mcudyrk2a4khkz',
  },
} as const;

export const ErrorCode = {
  TEMPORARY_ERROR_1sengclaw-markdown-to-html13: 1sengclaw-markdown-to-html13,
  USAGE_LIMIT_EXCEEDED: 1sengclaw-markdown-to-html37,
  MODEL_INCONSISTENT: 1sengclaw-markdown-to-html5sengclaw-markdown-to-html,
  MODEL_HEADER_INVALID: 1sengclaw-markdown-to-html52,
  IP_TEMPORARILY_BLOCKED: 1sengclaw-markdown-to-html6sengclaw-markdown-to-html,
} as const;

export class Model {
  static readonly UNSPECIFIED = new Model('unspecified', {}, false);
  static readonly G_3_sengclaw-markdown-to-html_PRO = new Model(
    'gemini-3.sengclaw-markdown-to-html-pro',
    { 'x-goog-ext-525sengclaw-markdown-to-htmlsengclaw-markdown-to-html1261-jspb': '[1,null,null,null,"9d8ca3786ebdfbea",null,null,sengclaw-markdown-to-html,[4],null,null,1]' },
    false,
  );
  static readonly G_3_sengclaw-markdown-to-html_FLASH = new Model(
    'gemini-3.sengclaw-markdown-to-html-flash',
    { 'x-goog-ext-525sengclaw-markdown-to-htmlsengclaw-markdown-to-html1261-jspb': '[1,null,null,null,"fbb127bbbsengclaw-markdown-to-html56c959",null,null,sengclaw-markdown-to-html,[4],null,null,1]' },
    false,
  );
  static readonly G_3_sengclaw-markdown-to-html_FLASH_THINKING = new Model(
    'gemini-3.sengclaw-markdown-to-html-flash-thinking',
    { 'x-goog-ext-525sengclaw-markdown-to-htmlsengclaw-markdown-to-html1261-jspb': '[1,null,null,null,"5bfsengclaw-markdown-to-html1184sengclaw-markdown-to-html784117a",null,null,sengclaw-markdown-to-html,[4],null,null,1]' },
    false,
  );
  static readonly G_3_1_PRO_PREVIEW = new Model(
    'gemini-3.1-pro-preview',
    {},
    false,
  );

  constructor(
    public readonly model_name: string,
    public readonly model_header: Record<string, string>,
    public readonly advanced_only: boolean,
  ) {}

  static from_name(name: string): Model {
    for (const model of [Model.UNSPECIFIED, Model.G_3_sengclaw-markdown-to-html_PRO, Model.G_3_sengclaw-markdown-to-html_FLASH, Model.G_3_sengclaw-markdown-to-html_FLASH_THINKING, Model.G_3_1_PRO_PREVIEW]) {
      if (model.model_name === name) return model;
    }

    throw new Error(
      `Unknown model name: ${name}. Available models: ${[Model.UNSPECIFIED, Model.G_3_sengclaw-markdown-to-html_PRO, Model.G_3_sengclaw-markdown-to-html_FLASH, Model.G_3_sengclaw-markdown-to-html_FLASH_THINKING, Model.G_3_1_PRO_PREVIEW]
        .map((m) => m.model_name)
        .join(', ')}`,
    );
  }

  static from_dict(model_dict: { model_name?: unknown; model_header?: unknown }): Model {
    if (!model_dict || typeof model_dict !== 'object') {
      throw new Error("When passing a custom model as a dictionary, 'model_name' and 'model_header' keys must be provided.");
    }

    if (!('model_name' in model_dict) || !('model_header' in model_dict)) {
      throw new Error("When passing a custom model as a dictionary, 'model_name' and 'model_header' keys must be provided.");
    }

    if (typeof model_dict.model_name !== 'string' || !model_dict.model_name.trim()) {
      throw new Error("When passing a custom model as a dictionary, 'model_name' must be a non-empty string.");
    }

    if (!model_dict.model_header || typeof model_dict.model_header !== 'object') {
      throw new Error("When passing a custom model as a dictionary, 'model_header' must be a dictionary containing valid header strings.");
    }

    const header: Record<string, string> = {};
    for (const [k, v] of Object.entries(model_dict.model_header as Record<string, unknown>)) {
      if (typeof v === 'string') header[k] = v;
    }

    return new Model(model_dict.model_name, header, false);
  }
}

