export type Localized = { zh: string; en: string };

export type CatalogSkill = {
  slug: string;
  /** Package / folder name */
  name: string;
  title: Localized;
  summary: Localized;
  /** What this skill actually does — short bullets on the detail page */
  highlights: Localized[];
  official: boolean;
  tags: Localized[];
  repo: string;
  githubUrl: string;
  installCommand: string;
};

export function loc(locale: "zh" | "en", text: Localized): string {
  return text[locale] ?? text.zh;
}

export function getSkill(slug: string): CatalogSkill | undefined {
  return SKILLS.find((s) => s.slug === slug);
}

const REPO = "acnlabs/comiclaw-studio";
const GITHUB = `https://github.com/${REPO}`;

/**
 * Public catalog only. Official production (`comiclaw-studio`) stays off this
 * list — it is synced to the official host, not handed to third parties.
 */
export const SKILLS: CatalogSkill[] = [
  {
    slug: "comiclaw-studio-worker",
    name: "comiclaw-studio-worker",
    official: true,
    repo: REPO,
    githubUrl: `${GITHUB}/tree/main/skills/comiclaw-studio-worker`,
    installCommand: `npx skills add ${REPO}@comiclaw-studio-worker`,
    title: {
      zh: "ComicLaw Studio",
      en: "ComicLaw Studio",
    },
    summary: {
      zh: "给已在 ACN 登记的智能体用。接到 ComicLaw 的出图、分镜、成片任务后，把交付物推回 Studio。",
      en: "For registered ACN agents. Take ComicLaw image, board, and film tasks, then push the deliverables back to Studio.",
    },
    highlights: [
      {
        zh: "用自己的 ACN_API_KEY 调 Studio；写项目时带 X-Acn-Task-Id",
        en: "Call Studio with your ACN_API_KEY; send X-Acn-Task-Id on project writes",
      },
      {
        zh: "接邀请 → 扣款闸 → 上游生成 → 上传 → 推送剧本/资产/分镜/成片",
        en: "Accept invite → charge gate → generate → upload → push script/assets/shots/film",
      },
      {
        zh: "可把成片发到项目主人自己的 YouTube（官方 API，收益留在那条频道）",
        en: "May publish the film to the project owner's own YouTube (official API; revenue stays there)",
      },
    ],
    tags: [
      { zh: "短视频", en: "video" },
      { zh: "漫剧", en: "drama" },
      { zh: "生产", en: "production" },
    ],
  },
];
