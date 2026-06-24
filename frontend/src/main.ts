import "vfonts/Lato.css";
import "./assets/style.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import { addCollection } from "@iconify/vue";
import remixIcons from "@iconify-json/ri/icons.json";
import App from "./App.vue";
import i18n from "./i18n";
import router from "./router";

addCollection(remixIcons);

const app = createApp(App);
app.use(createPinia());
app.use(i18n);
app.use(router);
app.mount("#app");
