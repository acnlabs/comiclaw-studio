import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const optionalStr = z.string().trim().optional().nullable();
const url = z.string().trim().url();
// 会被渲染成 <a href> 点击目标的外链字段:必须是 http(s) 绝对地址。
// 拦两类问题:1) 危险 scheme(javascript: 等)注入;2) 相对路径/裸域名这类
// "看起来像地址但点了就坏"的脏数据(本次角色卡死链事故的同类问题)。
// 空串视为清空(转为 null),与 optionalStr 的宽松语义兼容。
const optionalHttpUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), {
    message: "must be an absolute http(s) URL",
  })
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v));

export const ChargeActionEnum = z.enum([
  "script_gen",
  "asset_generate",
  "shot_generate",
  "video_generate",
  "post_production",
]);

export const StageEnum = z.enum([
  "SCRIPT",
  "ASSETS",
  "STORYBOARD",
  "FILM",
  "RELEASE",
  "DONE",
]);
export const AssetTypeEnum = z.enum(["CHARACTER", "SCENE", "PROP"]);
export const MediaTypeEnum = z.enum(["IMAGE", "VIDEO"]);
export const ReleaseStatusEnum = z.enum(["PENDING", "PUBLISHED"]);
export const WorkKindEnum = z.enum(["VIDEO", "SERIES"]);

export const createProjectSchema = z.object({
  name: nonEmpty.max(200),
  clientName: optionalStr,
  agentName: optionalStr,
  description: optionalStr,
  coverUrl: optionalStr,
  // 客户的 AgentPlanet 账号(Auth0 sub);传入后项目直接归属该用户
  ownerUserId: optionalStr,
});

export const updateProjectSchema = z.object({
  name: nonEmpty.max(200).optional(),
  clientName: optionalStr,
  agentName: optionalStr,
  description: optionalStr,
  coverUrl: optionalStr,
  currentStage: StageEnum.optional(),
  statusNote: z.string().max(200).optional().nullable(), // 实时状态,空字符串表示清除
});

export const scriptVersionSchema = z.object({
  content: nonEmpty,
  title: optionalStr,
  logline: optionalStr,
  changeLog: optionalStr,
});

export const createAssetSchema = z.object({
  type: AssetTypeEnum,
  name: nonEmpty.max(200),
  description: optionalStr,
  imageUrl: optionalStr,
  audioUrl: optionalStr, // 角色音色试听(声音样本)
  notes: optionalStr,
});

export const assetVersionSchema = z.object({
  imageUrl: url,
  audioUrl: optionalStr,
  notes: optionalStr,
});

export const createShotSchema = z.object({
  order: z.number().int().positive(),
  title: optionalStr,
  duration: z.number().positive().optional().nullable(),
  dialogue: optionalStr,
  action: optionalStr,
  prompt: optionalStr,
  mediaUrl: optionalStr,
  mediaType: MediaTypeEnum.optional(),
  assetIds: z.array(z.string()).optional(),
});

export const updateShotSchema = z.object({
  title: optionalStr,
  duration: z.number().positive().optional().nullable(),
  dialogue: optionalStr,
  action: optionalStr,
  prompt: optionalStr,
  assetIds: z.array(z.string()).optional(),
});

export const shotVersionSchema = z.object({
  mediaUrl: url,
  mediaType: MediaTypeEnum.optional(),
  notes: optionalStr,
});

export const filmVersionSchema = z.object({
  videoUrl: url,
  duration: z.number().positive().optional().nullable(),
  notes: optionalStr,
});

export const createReleaseSchema = z.object({
  platform: nonEmpty.max(100),
  url: optionalStr,
  status: ReleaseStatusEnum.optional(),
  publishedAt: z.coerce.date().optional().nullable(),
  notes: optionalStr,
});

export const updateReleaseSchema = z.object({
  url: optionalStr,
  status: ReleaseStatusEnum.optional(),
  publishedAt: z.coerce.date().optional().nullable(),
  notes: optionalStr,
});

export const createCharacterSchema = z.object({
  name: nonEmpty.max(200),
  tagline: optionalStr,
  persona: optionalStr,
  styleTags: optionalStr,
  imageUrl: url,
  audioUrl: optionalStr,
  gallery: optionalStr,
  introVideoUrl: optionalStr,
  acnAgentId: optionalStr,
  agentName: optionalStr,
  agentSummary: optionalStr,
  agentUrl: optionalHttpUrl,
  ownerUserId: optionalStr,
  sourceProjectId: optionalStr,
  isPublic: z.boolean().optional(),
  openForCasting: z.boolean().optional(),
  licensePoints: z.number().int().min(0).optional(),
});

export const updateCharacterSchema = z.object({
  name: nonEmpty.max(200).optional(),
  tagline: optionalStr,
  persona: optionalStr,
  styleTags: optionalStr,
  imageUrl: url.optional(),
  audioUrl: optionalStr,
  gallery: optionalStr,
  introVideoUrl: optionalStr,
  acnAgentId: optionalStr,
  agentName: optionalStr,
  agentSummary: optionalStr,
  agentUrl: optionalHttpUrl,
  isPublic: z.boolean().optional(),
  openForCasting: z.boolean().optional(),
  licensePoints: z.number().int().min(0).optional(),
});

export const publishWorkSchema = z
  .object({
    kind: WorkKindEnum,
    title: nonEmpty.max(200),
    category: optionalStr,
    description: optionalStr,
    coverUrl: optionalStr,
    videoUrl: optionalStr,
    authorName: optionalStr,
    characterIds: z.array(z.string()).optional(), // 参演的智能体角色
    episodes: z
      .array(
        z.object({
          order: z.number().int().positive(),
          title: optionalStr,
          videoUrl: url,
          duration: z.number().positive().optional().nullable(),
        })
      )
      .optional(),
  })
  .refine((d) => d.kind !== "VIDEO" || !!d.videoUrl, {
    message: "videoUrl is required for kind VIDEO",
    path: ["videoUrl"],
  })
  .refine((d) => d.kind !== "SERIES" || (d.episodes?.length ?? 0) > 0, {
    message: "episodes is required for kind SERIES",
    path: ["episodes"],
  });

export const chargeCreditsSchema = z.object({
  // 上限是防呆:这个端点只有主 comiclaw(STUDIO_API_KEY)能调,不是防攻击,
  // 是防一次生成任务因为单位换算错误多打几个零之类的操作失误
  amount: z.number().int().positive().max(100_000),
  action: ChargeActionEnum,
  provider: optionalStr, // 上游服务,如 seedance / jimeng
  reason: nonEmpty.max(200), // 传给 AgentPlanet 的 reason,如 video_gen:seedance:15s
  idempotencyKey: z.string().trim().min(8).max(128), // AgentPlanet 要求 8-128 字符,约定 comiclaw:gen:{jobId}
  metadata: z.record(z.string(), z.unknown()).optional(),
});
