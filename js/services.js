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
    update as updateData,
    remove,
    runTransaction
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
export function subscribePotions(callback, onError) {
    return onValue(ref(db, 'potions'), (snapshot) => {
        callback(snapshot.val() || {});
    }, onError);
}

export function subscribeIngredients(callback, onError) {
    return onValue(ref(db, 'ingredients'), (snapshot) => {
        callback(snapshot.val() || {});
    }, onError);
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

export function createPotion({
    name,
    category,
    description,
    salePrice,
    ingredients = {},
    hidden = false,
    hideRecipe = false,
    hideFromCodex = false
}) {
    validatePotion({ salePrice, ingredients });

    const id = Date.now().toString();
    return set(ref(db, `potions/${id}`), {
        name,
        category: category || 'General',
        description: description?.trim() || null,
        salePrice,
        ingredients,
        hidden: Boolean(hidden),
        hideRecipe: Boolean(hideRecipe),
        hideFromCodex: Boolean(hideFromCodex)
    });
}

export function updatePotion(id, {
    name,
    category,
    description,
    salePrice,
    ingredients = {},
    hidden = false,
    hideRecipe = false,
    hideFromCodex = false
}) {
    validatePotion({ salePrice, ingredients });
    return updateData(ref(db, `potions/${id}`), {
        name,
        category: category || 'General',
        description: description?.trim() || null,
        salePrice,
        ingredients: Object.keys(ingredients).length ? ingredients : null,
        hidden: Boolean(hidden),
        hideRecipe: Boolean(hideRecipe),
        hideFromCodex: Boolean(hideFromCodex)
    });
}

export function createIngredient({ name, description = '', price, stock, restockThreshold = 0, alwaysBuying = false }) {
    validateQuantity(stock);
    validateQuantity(restockThreshold);
    if (!Number.isFinite(price) || price < 0) {
        throw new Error('INVALID_PRICE');
    }

    const id = Date.now().toString();
    return set(ref(db, `ingredients/${id}`), {
        name,
        description: description.trim() || null,
        price,
        stock,
        restockThreshold,
        alwaysBuying: Boolean(alwaysBuying)
    });
}

export function updateIngredient(id, { name, description = '', price, stock, restockThreshold = 0, alwaysBuying = false }) {
    validateQuantity(stock);
    validateQuantity(restockThreshold);
    if (!Number.isFinite(price) || price < 0) {
        throw new Error('INVALID_PRICE');
    }

    return updateData(ref(db, `ingredients/${id}`), {
        name,
        description: description.trim() || null,
        locations: null,
        price,
        stock,
        restockThreshold,
        alwaysBuying: Boolean(alwaysBuying)
    });
}

export async function increaseIngredientStock(id, quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new Error('INVALID_STOCK_INCREMENT');
    }

    const result = await runTransaction(ref(db, `ingredients/${id}/stock`), (stock) => {
        if (!Number.isSafeInteger(stock) || stock < 0) return;
        const updatedStock = stock + quantity;
        return Number.isSafeInteger(updatedStock) ? updatedStock : undefined;
    });
    if (!result.committed) {
        throw new Error('STOCK_UPDATE_ABORTED');
    }
}

export function deletePotion(id) {
    return remove(ref(db, `potions/${id}`));
}

export function deleteIngredient(id, potions) {
    const updates = { [`ingredients/${id}`]: null };
    Object.entries(potions).forEach(([potionId, potion]) => {
        if (potion.ingredients && Object.prototype.hasOwnProperty.call(potion.ingredients, id)) {
            updates[`potions/${potionId}/ingredients/${id}`] = null;
        }
    });
    return updateData(ref(db), updates);
}

export async function brewBatch(batchQueue, potions) {
    if (batchQueue.length === 0) throw new Error('EMPTY_BATCH');

    const requiredIngredients = new Map();
    batchQueue.forEach(({ id, qty }) => {
        if (!Number.isSafeInteger(qty) || qty < 1) throw new Error('INVALID_BATCH_QUANTITY');
        const potion = potions[id];
        if (!potion) throw new Error('POTION_NOT_FOUND');
        const recipe = Object.entries(potion.ingredients || {});
        if (recipe.length === 0) throw new Error('MISSING_RECIPE');

        recipe.forEach(([ingredientId, quantity]) => {
            if (!Number.isSafeInteger(quantity) || quantity < 1) {
                throw new Error('INVALID_RECIPE');
            }
            const required = quantity * qty;
            const combined = (requiredIngredients.get(ingredientId) || 0) + required;
            if (!Number.isSafeInteger(required) || !Number.isSafeInteger(combined)) {
                throw new Error('INVALID_BATCH_QUANTITY');
            }
            requiredIngredients.set(ingredientId, combined);
        });
    });

    const result = await runTransaction(ref(db, 'ingredients'), (ingredients) => {
        if (!ingredients) return;
        for (const [ingredientId, quantity] of requiredIngredients) {
            const ingredient = ingredients[ingredientId];
            if (!ingredient || !Number.isSafeInteger(ingredient.stock) || ingredient.stock < quantity) return;
        }

        const updatedIngredients = { ...ingredients };
        for (const [ingredientId, quantity] of requiredIngredients) {
            updatedIngredients[ingredientId] = {
                ...ingredients[ingredientId],
                stock: ingredients[ingredientId].stock - quantity
            };
        }
        return updatedIngredients;
    });

    if (!result.committed) throw new Error('INSUFFICIENT_INGREDIENTS');
}

// ==========================================
// DISCORD WEBHOOKS
// ==========================================
export function generateOrderId() {
    const bytes = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        bytes[0] = Math.floor(Math.random() * 0x100000000);
    }
    return `MC-${bytes[0].toString(16).toUpperCase().padStart(8, '0')}`;
}

function isWebhookConfigured() {
    try {
        const url = new URL(DISCORD_WEBHOOK_URL);
        return url.protocol === "https:" &&
            (url.hostname === "discord.com" || url.hostname === "discordapp.com") &&
            url.pathname.startsWith("/api/webhooks/");
    } catch {
        return false;
    }
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

export async function dispatchOrder({ orderId, name, discord, notes, satchel, potions }) {
    if (!/^MC-[A-Z0-9]{8}$/.test(orderId || '')) {
        throw new Error('INVALID_ORDER_ID');
    }
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
        allowed_mentions: { parse: [] },
        embeds: [{
            title: "🧪 New Store Order",
            color: 7419530, // Purple
            fields: [
                { name: "Order ID", value: orderId, inline: true },
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
