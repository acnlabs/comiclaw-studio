/**
 * Local smoke: env, Google OAuth client, snapshot, publish gate.
 * Run: npx tsx scripts/smoke-youtube-local.ts
 */
import {
  signYoutubeOAuthState,
  verifyYoutubeOAuthState,
  youtubeConfigured,
  youtubeSecrets,
} from "../src/lib/youtubeCrypto";
import { youtubeAuthorizeUrl } from "../src/lib/youtubeApi";
import {
  checkYoutubePublishable,
  getYoutubePublishSnapshot,
  publishProjectToYoutube,
  resolveYoutubeAccountOwner,
} from "../src/lib/youtubePublish";
import { prisma } from "../src/lib/db";

function pass(label: string) {
  console.log("PASS", label);
}

async function main() {
  const secrets = youtubeSecrets();
  if (!youtubeConfigured() || !secrets) {
    throw new Error("YouTube env is incomplete");
  }
  pass("env loaded");
  console.log("redirect =", secrets.redirectUri);

  const state = signYoutubeOAuthState({
    sub: "auth0|youtube-smoke",
    returnTo: "/studio",
    secret: secrets.tokenSecret,
  });
  if (!verifyYoutubeOAuthState({ state, secret: secrets.tokenSecret })) {
    throw new Error("oauth state failed");
  }
  pass("oauth state");

  const url = youtubeAuthorizeUrl({
    clientId: secrets.clientId,
    redirectUri: secrets.redirectUri,
    state,
  });
  try {
    const authRes = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    console.log("Google authorize HTTP", authRes.status);
    if (authRes.status >= 400) {
      throw new Error(`Google rejected OAuth client: ${authRes.status}`);
    }
    pass("Google accepted OAuth client");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("WARN Google authorize unreachable from this machine:", msg);
  }

  if (!resolveYoutubeAccountOwner({ ownerKind: "user", ownerUserId: "auth0|youtube-smoke" }).ok) {
    throw new Error("owner resolve failed");
  }
  const gate = checkYoutubePublishable({
    configured: true,
    ownerUserId: "auth0|youtube-smoke",
    connected: false,
    hasFilm: true,
  });
  if (gate.ok || gate.reason !== "not_connected") {
    throw new Error(`unexpected gate ${JSON.stringify(gate)}`);
  }
  pass("gate blocks until connected");

  const project = await prisma.project.create({
    data: {
      name: "YouTube smoke",
      description: "local publish test",
      ownerKind: "user",
      ownerUserId: "auth0|youtube-smoke",
    },
  });
  await prisma.filmVersion.create({
    data: {
      projectId: project.id,
      version: 1,
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      duration: 10,
      notes: "smoke",
    },
  });

  const snap = await getYoutubePublishSnapshot(project.id);
  console.log(
    "snapshot",
    JSON.stringify({
      configured: snap?.configured,
      hasFilm: snap?.hasFilm,
      connected: snap?.connected,
      canPublish: snap?.canPublish,
      blockedReason: snap?.blockedReason,
    }),
  );
  if (
    !snap?.configured ||
    !snap.hasFilm ||
    snap.connected ||
    snap.canPublish ||
    snap.blockedReason !== "not_connected"
  ) {
    throw new Error("bad snapshot");
  }
  pass("snapshot ready but not connected");

  try {
    await publishProjectToYoutube(project.id, { title: "Smoke" });
    throw new Error("publish should have been refused");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("has not connected YouTube")) throw e;
    pass("publish refused without connection");
  }

  await prisma.project.delete({ where: { id: project.id } });
  await prisma.$disconnect();
  console.log("DONE");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
