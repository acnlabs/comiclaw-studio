"use client";

import { useState } from "react";
import WorkPlayer from "@/components/WorkPlayer";
import WorkDiscussion from "@/components/WorkDiscussion";

type EpisodeData = {
  id: string;
  order: number;
  title: string | null;
  videoUrl: string;
  duration: number | null;
  sourceWorkId?: string | null;
};

export default function WorkWatch({
  workId,
  title,
  videoUrl,
  coverUrl,
  episodes,
  initialEpisodeId,
}: {
  workId: string;
  title: string;
  videoUrl: string | null;
  coverUrl: string | null;
  episodes: EpisodeData[];
  initialEpisodeId?: string | null;
}) {
  const [current, setCurrent] = useState<EpisodeData | null>(
    (initialEpisodeId && episodes.find((e) => e.id === initialEpisodeId)) ||
      episodes[0] ||
      null,
  );
  const videoId = current?.sourceWorkId ?? current?.id ?? workId;
  const seedTitle = current?.title ? `${title} · ${current.title}` : title;

  function onCurrentChange(episode: EpisodeData) {
    setCurrent(episode);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("ep", episode.id);
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <WorkPlayer
        videoUrl={videoUrl}
        coverUrl={coverUrl}
        episodes={episodes}
        current={current}
        onCurrentChange={onCurrentChange}
      />
      <WorkDiscussion
        workId={workId}
        videoId={videoId}
        episodeId={current?.id}
        title={seedTitle}
      />
    </>
  );
}
