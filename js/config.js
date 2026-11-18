import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDI97czywdHlXzQxnAwrTopGduM3y2_ctk",
    authDomain: "montclaircodex.firebaseapp.com",
    databaseURL: "https://montclaircodex-default-rtdb.firebaseio.com",
    projectId: "montclaircodex",
    storageBucket: "montclaircodex.firebasestorage.app",
    messagingSenderId: "961628471163",
    appId: "1:961628471163:web:7dd92578114b7b002287de"
};

// TODO: Replace with actual discord webhook
export const DISCORD_WEBHOOK_URL = "DISCORD_WEBHOOK_URL";
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);