import { prisma } from "@/lib/db";
import { studioBus, type ProjectUpdatePayload } from "@/lib/events";

export const dynamic = "force-dynamic";

// SSE:客户端订阅项目更新,收到事件后刷新页面数据
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    select: { id: true },
  });
  if (!project) return new Response("Not found", { status: 404 });

  const channel = `project:${project.id}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: ProjectUpdatePayload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const listener = (payload: ProjectUpdatePayload) => send(payload);
      studioBus.on(channel, listener);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        studioBus.off(channel, listener);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      send({ event: "connected", at: Date.now() });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
