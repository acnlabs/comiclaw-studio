import { prisma } from "@/lib/db";
import { notFoundJson, unauthorized } from "@/lib/auth";
import { verifyUserToken } from "@/lib/userAuth";
import { assertCanUserContribute } from "@/lib/projectAccess";
import { authorFromUser, type ContentAuthor } from "@/lib/contentAuthor";
import {
  assertHumanContributePolicy,
  resolveEffectiveOrg,
} from "@/lib/orgBinding";

export type ContributeProject = {
  id: string;
  shareToken: string;
  visibility: string;
  isPrivate: boolean;
  ownerUserId: string | null;
};

export async function requireUserContributor(
  req: Request,
  shareToken: string
): Promise<
  | { sub: string; project: ContributeProject; author: ContentAuthor }
  | Response
> {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const project = await prisma.project.findUnique({
    where: { shareToken },
    select: {
      id: true,
      shareToken: true,
      visibility: true,
      isPrivate: true,
      ownerUserId: true,
    },
  });
  if (!project) return notFoundJson();

  const denied = assertCanUserContribute(project, sub);
  if (denied) return denied;

  const effective = await resolveEffectiveOrg(project.id);
  const policyDenied = assertHumanContributePolicy({
    effective,
    project,
    sub,
  });
  if (policyDenied) return policyDenied;

  return { sub, project, author: authorFromUser(sub) };
}
