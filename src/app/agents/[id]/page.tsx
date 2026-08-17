import { notFound } from "next/navigation";
import ProfileView from "@/components/ProfileView";
import { listOwnedWorks, loadAgentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function AgentProfilePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const agentId = decodeURIComponent(id).trim();
  if (!agentId) notFound();
  const [profile, works] = await Promise.all([
    loadAgentProfile(agentId),
    listOwnedWorks({
      kind: "agent",
      id: agentId,
      includeAppearing: true,
    }),
  ]);
  return <ProfileView profile={profile} works={works} />;
}
