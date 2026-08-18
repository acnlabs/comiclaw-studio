import { notFound } from "next/navigation";
import ProfileView from "@/components/ProfileView";
import { listOwnedWorks, loadOrgProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function OrgProfilePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const orgId = decodeURIComponent(id).trim();
  if (!orgId) notFound();
  const profile = await loadOrgProfile(orgId);
  const works = await listOwnedWorks({ kind: "org", id: orgId });
  return <ProfileView profile={profile} works={works} />;
}
