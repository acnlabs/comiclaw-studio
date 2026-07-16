import CastingReturn from "@/components/CastingReturn";
import NotFound from "@/app/not-found";

export default async function CastingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ characterId?: string; projectId?: string }>;
}) {
  const { characterId, projectId } = await searchParams;
  if (!characterId || !projectId) return <NotFound />;
  return <CastingReturn characterId={characterId} projectId={projectId} />;
}
