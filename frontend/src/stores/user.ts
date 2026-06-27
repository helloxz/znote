import { defineStore } from "pinia";
import req from "@/utils/req";
import router from "@/router";

export const useUserStore = defineStore("user", {
    state: () => ({
        userInfo: {
            username: "",
            email: "",
            role: "",
            avatar: "",
        },
    }),
    actions: {
        async clearLoginState(redirectTo = "/user/login") {
            // 清除 localStorage
            localStorage.removeItem("token");
            localStorage.removeItem("note-active-notebook-id");
            localStorage.removeItem("note-col1-width");
            localStorage.removeItem("note-col2-width");

            // 清除 sessionStorage
            sessionStorage.removeItem("userInfo");
            sessionStorage.removeItem("note-active-category-id");
            sessionStorage.removeItem("note-active-note-id");
            sessionStorage.removeItem("note:expandedCategories:1");

            this.userInfo = {
                username: "",
                email: "",
                role: "",
                avatar: "",
            };
            if (redirectTo) {
                await router.push(redirectTo);
            }
        },
        getCachedUserInfo() {
            const stored = sessionStorage.getItem("userInfo");
            if (!stored) {
                return;
            }
            this.userInfo = JSON.parse(stored);
        },
        async getUserInfo(forceRefresh = false) {
            if (forceRefresh) {
                sessionStorage.removeItem("userInfo");
            }

            const stored = sessionStorage.getItem("userInfo");
            if (stored && !forceRefresh) {
                this.userInfo = JSON.parse(stored);
                return this.userInfo;
            }

            const res = await req.get("/api/user/info");
            if (res.data?.code === 200) {
                this.userInfo = res.data.data;
                sessionStorage.setItem("userInfo", JSON.stringify(this.userInfo));
            }
            return this.userInfo;
        },
        async checkLogin() {
            try {
                const res = await req.get("/api/user/check_login");
                if (res.data?.code === 200) {
                    return true;
                }
            } catch {
                await this.clearLoginState("/user/login");
                return false;
            }

            await this.clearLoginState("/user/login");
            return false;
        },
        async logout() {
            try {
                await req.post("/api/user/logout");
            } finally {
                await this.clearLoginState("/");
            }
        },
    },
});
