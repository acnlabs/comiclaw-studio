import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { ProjectData } from "@/lib/types";
import { findFullProjectByToken } from "@/lib/projectQuery";
import { checkAdminKey } from "@/lib/auth";
import { ADMIN_COOKIE } from "@/app/api/admin/login/route";
import StudioWorkspace from "@/components/StudioWorkspace";
import LiveRefresh from "@/components/LiveRefresh";
import AutoClaim from "@/components/AutoClaim";
import PrivateProject from "@/components/PrivateProject";
import PrivacyToggle from "@/components/PrivacyToggle";

export const dynamic = "force-dynamic";

export default async function ProjectPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  const project = await findFullProjectByToken(token);
  if (!project) notFound();

  // 私密项目:管理员(Cookie)直接放行;其他访客走客户端主人校验
  if (project.isPrivate) {
    const cookieStore = await cookies();
    const isAdminViewer = checkAdminKey(cookieStore.get(ADMIN_COOKIE)?.value);
    if (!isAdminViewer) {
      return (
        <>
          <LiveRefresh token={token} />
          <PrivateProject shareToken={token} />
        </>
      );
    }
  }

  const data = JSON.parse(JSON.stringify(project)) as ProjectData;

  return (
    <>
      <LiveRefresh token={token} />
      <div className="px-4 sm:px-6">
        <AutoClaim shareToken={token} hasOwner={Boolean(project.ownerUserId)} />
        {project.ownerUserId && <PrivacyToggle shareToken={token} />}
      </div>
      <StudioWorkspace project={data} />
    </>
  );
}
