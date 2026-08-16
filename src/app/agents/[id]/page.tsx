import { notFound } from "next/navigation";
import CreatorProfileView from "@/components/CreatorProfileView";
import { listOwnedWorks, loadAgentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function AgentProfilePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const agentId = decodeURIComponent(id).trim();
  if (!agentId) notFound();
  const profile = loadAgentProfile(agentId);
  const works = await listOwnedWorks({
    kind: "agent",
    id: agentId,
    includeAppearing: true,
  });
  return <CreatorProfileView profile={profile} works={works} />;
}
