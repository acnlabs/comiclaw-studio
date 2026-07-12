import { EventEmitter } from "events";

// 进程内事件总线:agent 推送数据后通知对应项目的 SSE 订阅者。
// 单实例部署下够用;多实例时需替换为 Redis Pub/Sub 等。
const globalForBus = globalThis as unknown as { studioBus?: EventEmitter };

export const studioBus = globalForBus.studioBus ?? new EventEmitter();
studioBus.setMaxListeners(0);
globalForBus.studioBus = studioBus;

export interface ProjectUpdatePayload {
  event: string;
  at: number;
}

export function emitProjectUpdate(projectId: string, event: string) {
  const payload: ProjectUpdatePayload = { event, at: Date.now() };
  studioBus.emit(`project:${projectId}`, payload);
}
