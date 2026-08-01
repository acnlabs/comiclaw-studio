import LicenseReturn from "@/components/LicenseReturn";
import NotFound from "@/app/not-found";

export default async function AssetLicenseReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string; projectId?: string }>;
}) {
  const { assetId, projectId } = await searchParams;
  if (!assetId || !projectId) return <NotFound />;
  return (
    <LicenseReturn
      confirmPath="/api/user/asset-licenses/confirm"
      payload={{ assetId, projectId }}
      returnTo={`/license/return?assetId=${encodeURIComponent(assetId)}&projectId=${encodeURIComponent(projectId)}`}
    />
  );
}
