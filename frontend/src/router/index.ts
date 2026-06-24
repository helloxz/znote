import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: "/",
            name: "home",
            component: () => import("@/views/HomeView.vue"),
        },
        {
            path: "/dashboard",
            redirect: "/dashboard/home",
        },
        {
            path: "/dashboard/:name",
            name: "dashboard",
            component: () => import("@/views/DashboardView.vue"),
        },
        {
            path: "/user/init",
            name: "init",
            component: () => import("@/views/InitView.vue"),
        },
        {
            path: "/user/login",
            name: "login",
            component: () => import("@/views/LoginView.vue"),
        },
        {
            path: "/user/register",
            name: "register",
            component: () => import("@/views/RegisterView.vue"),
        },
    ],
});

router.beforeEach((to) => {
    const publicPaths = ["/", "/user/init", "/user/login", "/user/register"];
    if (publicPaths.includes(to.path)) {
        return true;
    }

    const token = localStorage.getItem("token");
    if (!token) {
        return "/user/login";
    }

    return true;
});

export default router;
