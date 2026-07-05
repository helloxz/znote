import { Cron } from "croner";
import { vectorizeNextBatch, updateVectorizedNotes } from "@/api/ai";

/** 所有已注册的定时任务实例 */
const cronJobs: Cron[] = [];

/** 启动所有定时任务 */
export function startCronJobs() {
    // 每 60 秒执行一次笔记向量化（新笔记入库）
    cronJobs.push(
        new Cron("* * * * * *", { interval: 60, protect: true }, async () => {
            await vectorizeNextBatch();
        })
    );

    // 每 5 分钟执行一次向量更新（已修改笔记重新向量化）
    cronJobs.push(
        new Cron("* * * * * *", { interval: 300, protect: true }, async () => {
            await updateVectorizedNotes();
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
