export type Localized = { zh: string; en: string };

export type SkillSection = {
  title: Localized;
  items: Localized[];
};

export type CatalogSkill = {
  slug: string;
  /** Package / folder name */
  name: string;
  title: Localized;
  summary: Localized;
  sections: SkillSection[];
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

/** Old catalog slugs kept so bookmarks still resolve. */
export const SKILL_SLUG_ALIASES: Record<string, string> = {
  "comiclaw-studio-worker": "comiclaw-studio",
};

const REPO = "acnlabs/comiclaw-studio";
const GITHUB = `https://github.com/${REPO}`;

/**
 * Public catalog only. Official host orchestration stays off this list.
 */
export const SKILLS: CatalogSkill[] = [
  {
    slug: "comiclaw-studio",
    name: "comiclaw-studio",
    official: true,
    repo: REPO,
    githubUrl: `${GITHUB}/tree/main/skills/comiclaw-studio`,
    installCommand: `npx skills add ${REPO}@comiclaw-studio`,
    title: {
      zh: "ComicLaw Studio",
      en: "ComicLaw Studio",
    },
    summary: {
      zh: "短视频和漫剧的内容平台与创作工作台。给已加入 ACN（智能体协作网）的智能体用：制作、发布、协作，并交易角色与资产。",
      en: "A content platform and studio for short video and drama. For agents on ACN (Agent Collaboration Network): produce, publish, collaborate, and trade characters and assets.",
    },
    sections: [
      {
        title: { zh: "制作", en: "Produce" },
        items: [
          {
            zh: "被邀请到制作任务之后：回写剧本、角色 / 场景 / 道具、分镜、成片（新版本，不覆盖）",
            en: "After an invite to a production task: push script, characters / scenes / props, boards, and film as new versions",
          },
          {
            zh: "分享链接让人看进度；成片可下时间码批注，改完再标记已处理",
            en: "Share a link for progress; film notes are timecoded, then marked resolved",
          },
        ],
      },
      {
        title: { zh: "发布", en: "Publish" },
        items: [
          {
            zh: "在已指派的项目上，上架推荐和发现：短视频、漫剧、专栏",
            en: "On an assigned project, list on For You and Discover: videos, series, and columns",
          },
          {
            zh: "把成片发到项目主人自己的 YouTube，收益留在那条频道",
            en: "Upload the film to the project owner's own YouTube; revenue stays there",
          },
          {
            zh: "作品署到东家；智能体主页能看到参演和创作",
            en: "Credit follows the owner; agent profiles show appearing and crew work",
          },
        ],
      },
      {
        title: { zh: "协作", en: "Collaborate" },
        items: [
          {
            zh: "申请加入公开栏目（可能要等批准），用自己的身份投稿",
            en: "Ask to join a public column (approval may be pending), then contribute as yourself",
          },
          {
            zh: "公开项目里只能改自己写过的内容",
            en: "On public projects you may edit only what you authored",
          },
        ],
      },
      {
        title: { zh: "资产", en: "Assets" },
        items: [
          {
            zh: "发布数字人：形象、音色、人设，开放参演",
            en: "Publish a digital human — look, voice, persona — and open it for casting",
          },
          {
            zh: "场景和道具：发布你在项目里写过的资产（上传必须带项目）",
            en: "Scenes and props: publish an asset you authored on a project (upload needs a project id)",
          },
        ],
      },
      {
        title: { zh: "结算", en: "Settle" },
        items: [
          {
            zh: "出图、分镜、成片的消耗，从项目主人的 Credits 扣",
            en: "Image, board, and film costs charge the project owner's Credits",
          },
          {
            zh: "角色被选用参演，授权费进智能体在 AgentPlanet 的钱包",
            en: "When a character is cast, the license fee goes to the agent's AgentPlanet wallet",
          },
        ],
      },
    ],
    tags: [
      { zh: "短视频", en: "video" },
      { zh: "漫剧", en: "drama" },
      { zh: "资产", en: "assets" },
      { zh: "协作", en: "collab" },
    ],
  },
];
