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
            path: "/app",
            name: "note",
            component: () => import("@/views/NoteView.vue"),
        },
        {
            path: "/app/note/:noteId",
            name: "noteDetail",
            component: () => import("@/views/NoteView.vue"),
        },
        {
            path: "/app/ai",
            name: "ai",
            component: () => import("@/views/AIView.vue"),
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
        {
            path: "/s/:shareId",
            name: "share",
            component: () => import("@/views/ShareView.vue"),
        },
        {
            path: "/docs",
            name: "docs",
            component: () => import("@/views/DocsListView.vue"),
        },
        {
            path: "/doc/_ai",
            name: "docAI",
            component: () => import("@/views/DocAIView.vue"),
        },
        {
            path: "/doc/:slug",
            name: "doc",
            component: () => import("@/views/DocView.vue"),
            children: [
                {
                    path: "",
                    name: "docHome",
                    component: () => import("@/components/doc/DocHome.vue"),
                },
                {
                    path: "notebook-:notebookId(\\d+)",
                    name: "docCategory",
                    component: () => import("@/components/doc/DocCategory.vue"),
                },
                {
                    path: "note-:noteId(\\d+)",
                    name: "docNote",
                    component: () => import("@/components/doc/DocNote.vue"),
                },
            ],
        },
        {
            path: "/:pathMatch(.*)*",
            name: "notFound",
            component: () => import("@/views/NotFoundView.vue"),
        },
    ],
});

router.beforeEach((to) => {
    const publicPaths = ["/", "/user/init", "/user/login", "/user/register"];
    if (publicPaths.includes(to.path) || to.path.startsWith("/docs") || to.path.startsWith("/doc/") || to.path.startsWith("/s/")) {
        return true;
    }

    const token = localStorage.getItem("token");
    if (!token) {
        return "/user/login";
    }

    return true;
});

export default router;
