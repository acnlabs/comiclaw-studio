import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { emitProjectUpdate } from "@/lib/events";
import { chargePointsForCasting } from "@/lib/agentplanet";
import { unauthorized, badRequest, notFoundJson } from "@/lib/auth";

// 授权:把角色市场的数字人添加到自己的项目角色库。
// 免费即时授予;付费需扣 AgentPlanet 积分(支付通道接入前返回 402)。
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const body = await req.json().catch(() => null);
  const { characterId, projectId } = body ?? {};
  if (typeof characterId !== "string" || !characterId) return badRequest("`characterId` is required");
  if (typeof projectId !== "string" || !projectId) return badRequest("`projectId` is required");

  const [character, project] = await Promise.all([
    prisma.agentCharacter.findUnique({ where: { id: characterId } }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerUserId: true },
    }),
  ]);
  if (!character || !character.isPublic) return notFoundJson("Character not found");
  if (!project) return notFoundJson("Project not found");
  // 只能添加到自己名下的项目
  if (project.ownerUserId !== sub) {
    return Response.json({ error: "Not your project" }, { status: 403 });
  }
  // 主人自己的角色随时可加;他人角色需开放参演
  const isOwnCharacter = character.ownerUserId != null && character.ownerUserId === sub;
  if (!isOwnCharacter && !character.openForCasting) {
    return Response.json({ error: "Character not open for casting" }, { status: 403 });
  }

  const existing = await prisma.castingLicense.findUnique({
    where: { characterId_projectId: { characterId, projectId } },
  });
  if (existing) {
    return Response.json({ license: existing, alreadyLicensed: true });
  }

  const points = isOwnCharacter ? 0 : character.licensePoints;
  if (points > 0) {
    const charge = await chargePointsForCasting({
      payerSub: sub,
      payeeAcnAgentId: character.acnAgentId,
      points,
      memo: `Casting license: ${character.name} -> project ${projectId}`,
    });
    if (!charge.ok) {
      return Response.json(
        {
          error:
            charge.reason === "INSUFFICIENT"
              ? "Insufficient points"
              : "Points payment channel not available yet",
          code: charge.reason,
        },
        { status: 402 }
      );
    }
  }

  // 授予 + 物化到项目资产库(角色资产,含形象与音色)
  const [license] = await prisma.$transaction([
    prisma.castingLicense.create({
      data: { characterId, projectId, licenseeSub: sub, points, status: "GRANTED" },
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
  return Response.json({ license }, { status: 201 });
}

// 查询当前用户对某角色的已授权项目
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();
  const url = new URL(req.url);
  const characterId = url.searchParams.get("characterId");
  if (!characterId) return badRequest("`characterId` is required");

  const licenses = await prisma.castingLicense.findMany({
    where: { characterId, licenseeSub: sub },
    select: { projectId: true },
  });
  return Response.json({ projectIds: licenses.map((l) => l.projectId) });
}
