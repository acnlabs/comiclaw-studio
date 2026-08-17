import { sendAcnCreditNotice, studioAgentId } from "@/lib/acn";
import {
  creditNoticeSummary,
  creditNoticeText,
  creditNotifyTargets,
  workWatchUrl,
} from "@/lib/creditNotifyText";
import { prisma } from "@/lib/db";

export {
  creditNoticeSummary,
  creditNoticeText,
  creditNotifyTargets,
  isNotifyableAgentId,
  studioPublicOrigin,
  workWatchUrl,
} from "@/lib/creditNotifyText";

/** 新上架或名单新增的 agent 发一条 ACN 通知。失败不影响上架;已发过的不重发。 */
export async function notifyCreditedAgents(workId: string): Promise<void> {
  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: {
      id: true,
      title: true,
      credits: { select: { agentId: true } },
      creditNotifies: { select: { agentId: true } },
    },
  });
  if (!work) return;

  const targets = creditNotifyTargets({
    credited: work.credits.map((row) => row.agentId),
    alreadySent: work.creditNotifies.map((row) => row.agentId),
    senderId: studioAgentId(),
  });
  if (targets.length === 0) return;

  const url = workWatchUrl(work.id);
  const title = work.title;
  const text = creditNoticeText({ title, url });
  const summary = creditNoticeSummary({ title, url });

  for (const agentId of targets) {
    try {
      const result = await sendAcnCreditNotice({
        targetAgentId: agentId,
        text,
        summary,
        contentUrl: url,
      });
      if (result !== "sent") continue;
      await prisma.workCreditNotify.upsert({
        where: { workId_agentId: { workId: work.id, agentId } },
        create: { workId: work.id, agentId },
        update: { sentAt: new Date() },
      });
    } catch (err) {
      console.error("[creditNotify] failed", work.id, agentId, err);
    }
  }
}
