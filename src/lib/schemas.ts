import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const optionalStr = z.string().trim().optional().nullable();
const url = z.string().trim().url();

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
  notes: optionalStr,
});

export const assetVersionSchema = z.object({
  imageUrl: url,
  notes: optionalStr,
});

export const createShotSchema = z.object({
  order: z.number().int().positive(),
  title: optionalStr,
  duration: z.number().positive().optional().nullable(),
  dialogue: optionalStr,
  action: optionalStr,
  mediaUrl: optionalStr,
  mediaType: MediaTypeEnum.optional(),
  assetIds: z.array(z.string()).optional(),
});

export const updateShotSchema = z.object({
  title: optionalStr,
  duration: z.number().positive().optional().nullable(),
  dialogue: optionalStr,
  action: optionalStr,
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

export const publishWorkSchema = z
  .object({
    kind: WorkKindEnum,
    title: nonEmpty.max(200),
    category: optionalStr,
    description: optionalStr,
    coverUrl: optionalStr,
    videoUrl: optionalStr,
    authorName: optionalStr,
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
