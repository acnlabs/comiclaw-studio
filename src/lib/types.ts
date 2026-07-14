// 传给客户端组件的序列化数据类型(Date 已转 ISO 字符串)

export type StageKey =
  | "SCRIPT"
  | "ASSETS"
  | "STORYBOARD"
  | "FILM"
  | "RELEASE"
  | "DONE";

// 流水线五阶段(展示文案见 i18n 的 stage.* / stageHint.*)
export const STAGE_KEYS = [
  "SCRIPT",
  "ASSETS",
  "STORYBOARD",
  "FILM",
  "RELEASE",
] as const satisfies readonly StageKey[];

export type AssetTypeKey = "CHARACTER" | "SCENE" | "PROP";

export const ASSET_TYPE_KEYS: AssetTypeKey[] = ["CHARACTER", "SCENE", "PROP"];

export interface ScriptVersionData {
  id: string;
  version: number;
  title: string | null;
  logline: string | null;
  content: string;
  changeLog: string | null;
  createdAt: string;
}

export interface AssetVersionData {
  id: string;
  version: number;
  imageUrl: string;
  audioUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AssetData {
  id: string;
  type: string;
  name: string;
  description: string | null;
  versions: AssetVersionData[]; // 按 version 倒序
}

export interface ShotVersionData {
  id: string;
  version: number;
  mediaUrl: string;
  mediaType: string;
  notes: string | null;
  createdAt: string;
}

export interface ShotData {
  id: string;
  order: number;
  title: string | null;
  duration: number | null;
  dialogue: string | null;
  action: string | null;
  prompt: string | null;
  selectedVersion: number | null;
  versions: ShotVersionData[]; // 按 version 倒序
  assetRefs: { asset: { id: string; name: string; type: string } }[];
}

export interface CommentData {
  id: string;
  timecode: number | null;
  content: string;
  authorName: string | null;
  status: string;
  createdAt: string;
}

export interface FilmVersionData {
  id: string;
  version: number;
  videoUrl: string;
  duration: number | null;
  notes: string | null;
  createdAt: string;
  comments: CommentData[];
}

export interface ReleaseData {
  id: string;
  platform: string;
  url: string | null;
  status: string;
  publishedAt: string | null;
  notes: string | null;
}

export interface ProjectData {
  id: string;
  shareToken: string;
  name: string;
  clientName: string | null;
  agentName: string | null;
  description: string | null;
  coverUrl: string | null;
  currentStage: string;
  statusNote: string | null;
  updatedAt: string;
  scriptVersions: ScriptVersionData[];
  assets: AssetData[];
  shots: ShotData[];
  filmVersions: FilmVersionData[];
  releases: ReleaseData[];
}
