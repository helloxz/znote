import { defineStore } from "pinia";
import req from "@/utils/req";

export const useSiteStore = defineStore("site", {
    state: () => ({
        appInfo: {
            app_name: "Zest",
            version: "0.1.0",
            date: "-",
            total_user_count: 0,
        },
    }),
    actions: {
        async fetchAppInfo() {
            const res = await req.get("/api/admin/app_info");
            if (res.data?.code === 200 && res.data?.data) {
                Object.assign(this.appInfo, res.data.data);
            }
            return this.appInfo;
        },
    },
});
