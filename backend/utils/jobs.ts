import { Cron } from "croner";
import { vectorizeNextBatch } from "@/api/ai";

/** 所有已注册的定时任务实例 */
const cronJobs: Cron[] = [];

/** 启动所有定时任务 */
export function startCronJobs() {
    // 每 60 秒执行一次笔记向量化
    cronJobs.push(
        new Cron("* * * * * *", { interval: 60, protect: true }, async () => {
            await vectorizeNextBatch();
        })
    );
}

/** 停止所有定时任务 */
export function stopCronJobs() {
    for (const job of cronJobs) {
        job.stop();
    }
    cronJobs.length = 0;
}
