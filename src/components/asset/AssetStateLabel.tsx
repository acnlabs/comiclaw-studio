"use client";

import { useT } from "@/components/LocaleProvider";
import { PUBLISHED, PUBLISH_DRAFT } from "@/lib/assetPublish";

/** Where an asset stands: a draft, mid-registration, or published and held by whom. */
export default function AssetStateLabel({
  publishState,
  ownerType,
  className = "text-xs text-zinc-500",
}: {
  publishState: string;
  ownerType: string | null | undefined;
  className?: string;
}) {
  const { t } = useT();
  const isPublished = publishState === PUBLISHED;
  const inFlight = publishState !== PUBLISH_DRAFT && !isPublished;

  return (
    <span className={className}>
      {isPublished
        ? ownerType === "org"
          ? t("assetPublish.ownedByOrg")
          : ownerType === "agent"
            ? t("assetPublish.ownedByAgent")
            : t("assetPublish.ownedByYou")
        : inFlight
          ? t("assetPublish.inFlight")
          : t("assetPublish.draft")}
    </span>
  );
}
