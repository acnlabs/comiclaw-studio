// 传给客户端组件的序列化数据类型(Date 已转 ISO 字符串)

export type StageKey =
  | "SCRIPT"
  | "ASSETS"
  | "STORYBOARD"
  | "FILM"
  | "RELEASE"
  | "DONE";

export const STAGES: { key: StageKey; label: string; hint: string }[] = [
  { key: "SCRIPT", label: "剧本", hint: "创作与解析" },
  { key: "ASSETS", label: "资产", hint: "角色 · 场景 · 道具" },
  { key: "STORYBOARD", label: "分镜", hint: "逐镜生成" },
  { key: "FILM", label: "成片", hint: "后期合成" },
  { key: "RELEASE", label: "发行", hint: "上架分发" },
];

export type AssetTypeKey = "CHARACTER" | "SCENE" | "PROP";

export const ASSET_TYPES: { key: AssetTypeKey; label: string }[] = [
  { key: "CHARACTER", label: "角色" },
  { key: "SCENE", label: "场景" },
  { key: "PROP", label: "道具" },
];

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
  versions: ShotVersionData[]; // 按 version 倒序
  assetRefs: { asset: { id: string; name: string; type: string } }[];
}

export interface FilmVersionData {
  id: string;
  version: number;
  videoUrl: string;
  duration: number | null;
  notes: string | null;
  createdAt: string;
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
  updatedAt: string;
  scriptVersions: ScriptVersionData[];
  assets: AssetData[];
  shots: ShotData[];
  filmVersions: FilmVersionData[];
  releases: ReleaseData[];
}
