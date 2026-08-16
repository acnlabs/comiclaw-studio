import { notFound } from "next/navigation";
import CreatorProfileView from "@/components/CreatorProfileView";
import { listOwnedWorks, loadOrgProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function OrgProfilePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const orgId = decodeURIComponent(id).trim();
  if (!orgId) notFound();
  const profile = loadOrgProfile(orgId);
  const works = await listOwnedWorks({ kind: "org", id: orgId });
  return <CreatorProfileView profile={profile} works={works} />;
}
