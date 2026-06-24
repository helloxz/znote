import { createI18n } from "vue-i18n";
import zh from "./locales/zh";
import en from "./locales/en";

const browserLang = navigator.language.startsWith("zh") ? "zh" : "en";

export default createI18n({
    legacy: false,
    locale: browserLang,
    fallbackLocale: "en",
    messages: {
        zh,
        en,
    },
});
