export const vUsername = (username: string): boolean => {
    return /^[a-z0-9]{3,16}$/.test(username);
};

export const vPassword = (password: string): boolean => {
    return /^[a-zA-Z0-9!@#$%^&*()_+\.]{6,18}$/.test(password);
};

export const vEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
