import { auth, db, DISCORD_WEBHOOK_URL } from "./config.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    ref,
    onValue,
    set
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// FIREBASE AUTH
// ==========================================
export function subscribeAuth(callback) {
    return onAuthStateChanged(auth, callback);
}

export function loginUser(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function logoutUser() {
    return signOut(auth);
}

// ==========================================
// FIREBASE REALTIME DATABASE
// ==========================================
export function subscribePotions(callback) {
    return onValue(ref(db, 'potions'), (snapshot) => {
        callback(snapshot.val() || {});
    });
}

export function subscribeIngredients(callback) {
    return onValue(ref(db, 'ingredients'), (snapshot) => {
        callback(snapshot.val() || {});
    });
}

export function createPotion({ name, category, salePrice }) {
    const id = Date.now().toString();
    return set(ref(db, `potions/${id}`), {
        name,
        category: category || 'General',
        salePrice,
        hidden: false
    });
}

export function createIngredient({ name, price }) {
    const id = Date.now().toString();
    return set(ref(db, `ingredients/${id}`), {
        name,
        price: price || 0
    });
}

// ==========================================
// DISCORD WEBHOOKS
// ==========================================
function isWebhookConfigured() {
    return (
        DISCORD_WEBHOOK_URL &&
        !DISCORD_WEBHOOK_URL.includes("PLACEHOLDER") &&
        !DISCORD_WEBHOOK_URL.includes("__DISCORD_WEBHOOK")
    );
}

async function postWebhook(payload) {
    if (!isWebhookConfigured()) {
        throw new Error("WEBHOOK_UNCONFIGURED");
    }

    const res = await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok && res.status !== 204) {
        throw new Error(`HTTP_${res.status}`);
    }
}

export async function dispatchOrder({ name, discord, notes, satchel, potions }) {
    const orderLines = [];
    let total = 0;

    satchel.forEach((item) => {
        const p = potions[item.id];
        if (p) {
            orderLines.push(`• **${item.qty}x ${p.name}**`);
            total += (p.salePrice || 0) * item.qty;
        }
    });

    const payload = {
        embeds: [{
            title: "🧪 New Store Order",
            color: 7419530, // Purple
            fields: [
                { name: "Client", value: name, inline: true },
                { name: "Discord", value: discord || "N/A", inline: true },
                { name: "Total Cost", value: `${total} Gold`, inline: true },
                { name: "Items", value: orderLines.join('\n') },
                { name: "Notes", value: notes || "None" }
            ],
            timestamp: new Date().toISOString()
        }]
    };

    await postWebhook(payload);
}

export async function dispatchMissive({ author, type, content }) {
    const contentMessage = type === 'price'
        ? `💰 **Codex Price Missive**\nFrom: ${author}\n\n${content}`
        : `📜 **Codex Letter**\nFrom: ${author}\n\n"${content}"`;

    await postWebhook({ content: contentMessage });
}