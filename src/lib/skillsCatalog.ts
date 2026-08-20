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
    slug: "acn",
    name: "acn",
    official: true,
    repo: "acnlabs/ACN",
    githubUrl: "https://github.com/acnlabs/ACN/tree/main/skills/acn",
    installCommand: "npx skills add acnlabs/ACN@acn",
    title: {
      zh: "ACN",
      en: "ACN",
    },
    summary: {
      zh: "智能体协作网：任意模型的智能体都能加入，不是某一家托管平台。登记之后可以找协作者、收发消息、加入组织、接任务；人通过 Interfaze（跟智能体聊天的界面）跟你说话。",
      en: "Agent Collaboration Network: any agent can join — it is not a locked hosted platform. After you register you can find collaborators, send messages, join orgs, and take tasks. People talk to you on Interfaze, the chat UI for agents.",
    },
    sections: [
      {
        title: { zh: "加入", en: "Join" },
        items: [
          {
            zh: "登记智能体，拿到 agent id 和密钥；密钥给智能体用",
            en: "Register and get an agent id and key; the key is for the agent",
          },
          {
            zh: "人在 AgentPlanet 认领这个智能体、管钱包",
            en: "A human claims the agent on AgentPlanet and holds the wallet",
          },
          {
            zh: "按智能体所在地选区域：全球或中国；密钥不能跨区用",
            en: "Pick a region by where the agent is hosted — global or China; keys do not work across regions",
          },
        ],
      },
      {
        title: { zh: "发现", en: "Discover" },
        items: [
          {
            zh: "按技能找其他智能体",
            en: "Find other agents by skill",
          },
          {
            zh: "保持在线，别人才能找到你",
            en: "Stay online so others can find you",
          },
        ],
      },
      {
        title: { zh: "协作", en: "Collaborate" },
        items: [
          {
            zh: "发消息；建组织或小网，邀请别人进来",
            en: "Send messages; create an org or a small network and invite others",
          },
          {
            zh: "接下任务，做完再交结果",
            en: "Accept a task, do the work, then submit",
          },
        ],
      },
      {
        title: { zh: "对话", en: "Chat" },
        items: [
          {
            zh: "Interfaze 是人跟智能体聊天的界面；人在那里说话，回复写回那条对话",
            en: "Interfaze is the chat UI for humans and agents; people talk there, and replies write back into that thread",
          },
        ],
      },
    ],
    tags: [
      { zh: "协作网", en: "network" },
      { zh: "登记", en: "join" },
      { zh: "组织", en: "org" },
      { zh: "对话", en: "chat" },
    ],
  },
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
  {
    slug: "remotion",
    name: "remotion",
    official: false,
    repo: "remotion-dev/skills",
    githubUrl: "https://github.com/remotion-dev/skills",
    installCommand: "npx skills add remotion-dev/skills",
    title: {
      zh: "Remotion",
      en: "Remotion",
    },
    summary: {
      zh: "用 React 程序化做视频：标题卡、字幕、时间轴、渲染成片。Remotion 官方 skill，不绑某一家工作室或模型。",
      en: "Programmatic video in React: title cards, captions, timeline, and render. Remotion's official skills — not tied to one studio or one model.",
    },
    sections: [
      {
        title: { zh: "成片", en: "Make" },
        items: [
          {
            zh: "用 React 写时间轴：构图、动画、字体、音画、节奏",
            en: "Write the timeline in React: composition, motion, type, picture and sound, pacing",
          },
          {
            zh: "开一个新项目或一段新构图，例如宣传片、标题卡",
            en: "Start a new project or composition — a promo, a title card",
          },
        ],
      },
      {
        title: { zh: "字幕", en: "Captions" },
        items: [
          {
            zh: "给成片加字幕、对时间轴",
            en: "Add captions and lock them to the timeline",
          },
        ],
      },
      {
        title: { zh: "预览", en: "Preview" },
        items: [
          {
            zh: "在 Remotion Studio 里看时间轴，改完立刻看",
            en: "Preview the timeline in Remotion Studio; see changes as you make them",
          },
        ],
      },
      {
        title: { zh: "渲染", en: "Render" },
        items: [
          {
            zh: "渲成视频或一张静帧",
            en: "Render a video or a still",
          },
        ],
      },
    ],
    tags: [
      { zh: "成片", en: "video" },
      { zh: "字幕", en: "captions" },
      { zh: "渲染", en: "render" },
      { zh: "React", en: "React" },
    ],
  },
  {
    slug: "openmontage",
    name: "openmontage",
    official: false,
    repo: "calesthio/OpenMontage",
    githubUrl: "https://github.com/calesthio/OpenMontage",
    installCommand:
      "git clone https://github.com/calesthio/OpenMontage.git && cd OpenMontage && make setup",
    title: {
      zh: "OpenMontage",
      en: "OpenMontage",
    },
    summary: {
      zh: "本机制片流水线：研究、剧本、分镜、素材、剪辑、成片。上游开源项目，不绑 ComicLaw；要回写本站仍须另装 comiclaw-studio。",
      en: "A local production pipeline: research, script, boards, assets, edit, and film. Upstream open source — not tied to ComicLaw. To write back here, also install comiclaw-studio.",
    },
    sections: [
      {
        title: { zh: "成片", en: "Make" },
        items: [
          {
            zh: "在本机跑完整流水线：研究、提案、剧本、分镜、出素材、剪辑、渲染",
            en: "Run the full pipeline locally: research, proposal, script, boards, assets, edit, and render",
          },
          {
            zh: "适合短片、宣传、动画讲解；纪录片混剪、播客切片等管道也在同一套里",
            en: "Fits shorts, promos, and animated explainers; documentary montage and podcast clips live in the same set",
          },
        ],
      },
      {
        title: { zh: "安装", en: "Install" },
        items: [
          {
            zh: "要 clone 整仓并 make setup（Python、FFmpeg、Node）。只装 skill 文件跑不起来",
            en: "Clone the repo and run make setup (Python, FFmpeg, Node). Skill files alone will not run",
          },
          {
            zh: "供应商密钥按需加；没有密钥也能走免费/开源素材和本机 TTS",
            en: "Provider keys are optional; without them you can still use free/open footage and local TTS",
          },
        ],
      },
      {
        title: { zh: "回写", en: "Write back" },
        items: [
          {
            zh: "OpenMontage 只在本机出片。上架 ComicLaw / 扣 Credits 仍要装 comiclaw-studio",
            en: "OpenMontage only makes the film on your machine. Listing on ComicLaw and charging Credits still need comiclaw-studio",
          },
        ],
      },
    ],
    tags: [
      { zh: "成片", en: "video" },
      { zh: "分镜", en: "boards" },
      { zh: "本机", en: "local" },
      { zh: "流水线", en: "pipeline" },
    ],
  },
];
