import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import type { AgentCharacter } from "@prisma/client";

// 授予选角授权 + 物化角色到项目资产库(免费授予与付费确认共用)
export async function grantLicense(args: {
  character: AgentCharacter;
  projectId: string;
  sub: string;
  points: number;
  orderId: string | null;
}) {
  const { character, projectId, sub, points, orderId } = args;
  const [license] = await prisma.$transaction([
    prisma.castingLicense.upsert({
      where: { characterId_projectId: { characterId: character.id, projectId } },
      create: {
        characterId: character.id,
        projectId,
        licenseeSub: sub,
        points,
        status: "GRANTED",
        storeOrderId: orderId,
      },
      update: { status: "GRANTED", points, storeOrderId: orderId },
    }),
    prisma.asset.create({
      data: {
        projectId,
        type: "CHARACTER",
        name: character.name,
        description:
          character.tagline ??
          (character.persona ? character.persona.slice(0, 200) : null),
        versions: {
          create: {
            version: 1,
            imageUrl: character.imageUrl,
            audioUrl: character.audioUrl,
            notes: "来自角色市场授权 / Licensed from Cast",
          },
        },
      },
    }),
  ]);
  emitProjectUpdate(projectId, "asset.created");
  return license;
}
