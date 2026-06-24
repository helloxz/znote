import { Hono } from "hono";
import { adminRouter, publicRouter, userRouter } from "./routers";

const app = new Hono();

app.route("/", publicRouter);
app.route("/", userRouter);
app.route("/", adminRouter);

export default {
    port: Number(Bun.env.ZEST_PORT || 3080),
    fetch: app.fetch,
    idleTimeout: 120,
};
