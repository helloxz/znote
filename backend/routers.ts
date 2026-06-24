import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { index } from "@/api/html";
import { getAppInfo } from "@/api/info";
import { getUserSetting, setUserSetting } from "@/api/setting";
import { getSystemStatus } from "@/api/system";
import {
    changePassword,
    checkLogin,
    initUser,
    listUsers,
    login,
    logout,
    register,
    resetAdminPassword,
    resetUserPassword,
    userInfo,
} from "@/api/user";
import { verifyApiToken } from "@/middleware/auth";
import type { AppVariables } from "@/types";

const allowedOrigin = Bun.env.ZEST_CORS_ORIGIN?.trim() || "*";

const corsOptions = {
    origin: allowedOrigin === "*"
        ? "*"
        : (origin: string) => {
            const allowedOrigins = allowedOrigin.split(",").map((item) => item.trim()).filter(Boolean);
            return allowedOrigins.includes(origin) ? origin : "";
        },
};

export const publicRouter = new Hono<{ Variables: AppVariables }>();
export const userRouter = new Hono<{ Variables: AppVariables }>().basePath("/api/user");
export const adminRouter = new Hono<{ Variables: AppVariables }>().basePath("/api/admin");

publicRouter.use("*", cors(corsOptions));
userRouter.use("*", cors(corsOptions), bearerAuth({ verifyToken: (t, c) => verifyApiToken(t, c, "user") }));
adminRouter.use("*", cors(corsOptions), bearerAuth({ verifyToken: (t, c) => verifyApiToken(t, c, "admin") }));

publicRouter.use(
    "/static/*",
    serveStatic({
        root: "./public",
        onFound: (_path, c) => {
            c.header("Cache-Control", "public, immutable, max-age=604800");
        },
    }),
);

publicRouter.get("/", index);
publicRouter.get("/dashboard", index);
publicRouter.get("/dashboard/*", index);
publicRouter.get("/user", index);
publicRouter.get("/user/*", index);

publicRouter.get("/api/system/status", getSystemStatus);
publicRouter.post("/api/init_user", initUser);
publicRouter.post("/api/login", login);
publicRouter.post("/api/register", register);
publicRouter.get("/reset_admin_password", resetAdminPassword);

userRouter.get("/info", userInfo);
userRouter.get("/check_login", checkLogin);
userRouter.post("/logout", logout);
userRouter.post("/change_password", changePassword);
userRouter.get("/get_user_setting", getUserSetting);
userRouter.post("/set_user_setting", setUserSetting);

adminRouter.get("/app_info", getAppInfo);
adminRouter.get("/list_users", listUsers);
adminRouter.post("/reset_user_password", resetUserPassword);
