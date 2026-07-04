export const menuConfig = [
    {
        id: "home",
        titleKey: "dashboard.home",
        icon: "ri:dashboard-line",
        route: "/dashboard/home",
    },
    {
        id: "notes",
        titleKey: "menu.notes",
        icon: "ri:booklet-line",
        route: "/app",
    },
    {
        id: "docs",
        titleKey: "dashboard.docs",
        icon: "ri:file-text-line",
        route: "/dashboard/docs",
    },
    {
        id: "users",
        titleKey: "dashboard.users",
        icon: "ri:user-line",
        route: "/dashboard/users",
    },
    {
        id: "system",
        titleKey: "dashboard.system",
        icon: "ri:settings-3-line",
        expanded: false,
        children: [
            {
                id: "site_setting",
                titleKey: "dashboard.site_setting",
                icon: "ri:global-line",
                route: "/dashboard/site_setting",
            },
            {
                id: "ai_setting",
                titleKey: "dashboard.ai_setting",
                icon: "ri:robot-2-line",
                route: "/dashboard/ai_setting",
            },
        ],
    },
];
