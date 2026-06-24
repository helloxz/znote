import axios from "axios";

const req = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/",
    timeout: 120000,
});

req.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default req;
