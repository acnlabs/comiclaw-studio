import LicenseReturn from "@/components/LicenseReturn";
import NotFound from "@/app/not-found";

export default async function CastingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ characterId?: string; projectId?: string }>;
}) {
  const { characterId, projectId } = await searchParams;
  if (!characterId || !projectId) return <NotFound />;
  return (
    <LicenseReturn
      confirmPath="/api/user/casting/confirm"
      payload={{ characterId, projectId }}
      returnTo={`/casting/return?characterId=${encodeURIComponent(characterId)}&projectId=${encodeURIComponent(projectId)}`}
    />
  );
}
