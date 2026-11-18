import { auth, db, DISCORD_WEBHOOK_URL } from "./config.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    ref,
    onValue,
    set,
    update as updateData
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

function validateQuantity(quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
        throw new Error('INVALID_QUANTITY');
    }
}

function validatePotion({ salePrice, ingredients = {} }) {
    if (!Number.isFinite(salePrice) || salePrice < 0) {
        throw new Error('INVALID_PRICE');
    }
    for (const quantity of Object.values(ingredients)) {
        if (!Number.isSafeInteger(quantity) || quantity < 1) {
            throw new Error('INVALID_RECIPE_QUANTITY');
        }
    }
}

export function createPotion({ name, category, salePrice, ingredients = {} }) {
    validatePotion({ salePrice, ingredients });

    const id = Date.now().toString();
    return set(ref(db, `potions/${id}`), {
        name,
        category: category || 'General',
        salePrice,
        ingredients,
        hidden: false
    });
}

export function updatePotion(id, { name, category, salePrice, ingredients = {} }) {
    validatePotion({ salePrice, ingredients });
    return updateData(ref(db, `potions/${id}`), {
        name,
        category: category || 'General',
        salePrice,
        ingredients: Object.keys(ingredients).length ? ingredients : null
    });
}

export function createIngredient({ name, price, stock }) {
    validateQuantity(stock);
    if (!Number.isFinite(price) || price < 0) {
        throw new Error('INVALID_PRICE');
    }

    const id = Date.now().toString();
    return set(ref(db, `ingredients/${id}`), {
        name,
        price,
        stock
    });
}

export function updateIngredient(id, { name, price, stock }) {
    validateQuantity(stock);
    if (!Number.isFinite(price) || price < 0) {
        throw new Error('INVALID_PRICE');
    }

    return updateData(ref(db, `ingredients/${id}`), { name, price, stock });
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
