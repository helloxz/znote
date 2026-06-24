import { defineStore } from "pinia";
import req from "@/utils/req";

export const useSystemStore = defineStore("system", {
    state: () => ({
        status: {
            app_name: "Zest",
            initialized: false,
            allow_register: true,
        },
    }),
    actions: {
        async fetchStatus() {
            const res = await req.get("/api/system/status");
            if (res.data?.code === 200) {
                this.status = res.data.data;
            }
            return this.status;
        },
    },
});
