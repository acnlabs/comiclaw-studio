import { notFound } from "next/navigation";
import ProfileView from "@/components/ProfileView";
import { listOwnedWorks, loadUserProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function UserProfilePage(props: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await props.params;
  const profile = await loadUserProfile(handle);
  if (!profile) notFound();
  const works = await listOwnedWorks({ kind: "user", id: profile.id });
  return <ProfileView profile={profile} works={works} />;
}
