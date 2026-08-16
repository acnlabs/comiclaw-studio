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
  authorUserId?: string | null;
  authorAgentId?: string | null;
  authorKey?: string;
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
  authorUserId?: string | null;
  authorAgentId?: string | null;
  authorKey?: string;
  // 发布为可交易资产后的状态与产权(draft | publishing | published | unpublishing)
  publishState?: string;
  publishedVersionId?: string | null;
  ownerType?: string | null;
  licensePoints?: number;
  ownerId?: string | null;
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
  authorUserId?: string | null;
  authorAgentId?: string | null;
  authorKey?: string;
  versions: ShotVersionData[]; // 按 version 倒序
  assetRefs: {
    asset: {
      id: string;
      name: string;
      type: string;
      versions?: { imageUrl: string }[]; // 最新设定图(用于头像展示)
    };
  }[];
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
  authorUserId?: string | null;
  authorAgentId?: string | null;
  authorKey?: string;
  basedOnFilmVersionId?: string | null;
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
  visibility?: string;
  ownerUserId?: string | null;
  columnId?: string | null;
  entryOrder?: number | null;
  /** 归属栏目;共创项目与其所答的一记同栏目 */
  column?: { name: string; slug: string } | null;
  /** 有值 = 这是那一记下的共创项目 */
  parentProject?: {
    name: string;
    shareToken: string;
    entryOrder: number | null;
  } | null;
  currentStage: string;
  statusNote: string | null;
  updatedAt: string;
  scriptVersions: ScriptVersionData[];
  assets: AssetData[];
  shots: ShotData[];
  filmVersions: FilmVersionData[];
  releases: ReleaseData[];
  work?: { id: string; title: string } | null;
  seriesWorkId?: string | null;
  seriesWork?: { id: string; title: string } | null;
}

export interface SeriesOption {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
}

export interface ComiclawPublishSnapshot {
  hasFilm: boolean;
  canChooseSeries: boolean;
  video: {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    authorName: string | null;
  } | null;
  series: SeriesOption | null;
  defaults: {
    title: string;
    description: string;
    coverUrl: string;
    authorName: string;
    mode: "video" | "episode";
    episodeOrder: number;
    episodeTitle: string;
    seriesWorkId: string;
    seriesTitle: string;
    seriesDescription: string;
    seriesCoverUrl: string;
  };
  seriesOptions: SeriesOption[];
}

export interface ColumnData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  updatedAt: string;
}
