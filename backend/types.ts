export type AppRole = "admin" | "user";

export type AppVariables = {
    uid: number;
    role: AppRole;
    username: string;
    token: string;
};
