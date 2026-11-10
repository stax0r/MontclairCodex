import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, set, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// CONFIGURATION
// ==========================================
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1569549902634287114/wdeWFMIEmipCe-R_X-tARtNA9Uu3nxAZYsRGbkIZ8uDjkYoe6Q-r-wC32f9tiyBcGiQE";

// ==========================================
// STATE (NO MOCKS - STARTS BLANK)
// ==========================================
let state = {
    potions: {},
    ingredients: {},
    locations: {},
    prices: {},
    satchel: [],
    batchQueue: [],
    selectedCategory: 'All',
    searchQuery: ''
};

// ==========================================
// TOAST SYSTEM
// ==========================================
window.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// ==========================================
// TAB NAVIGATION
// ==========================================
const tabStore = document.getElementById('tab-store');
const tabCodex = document.getElementById('tab-codex');
const viewStore = document.getElementById('view-store');
const viewCodex = document.getElementById('view-codex');

tabStore?.addEventListener('click', () => {
    tabStore.classList.add('active', 'text-white');
    tabStore.classList.remove('text-zinc-500');
    tabCodex.classList.remove('active', 'text-white');
    tabCodex.classList.add('text-zinc-500');
    viewStore.classList.remove('hidden');
    viewCodex.classList.add('hidden');
});

tabCodex?.addEventListener('click', () => {
    tabCodex.classList.add('active', 'text-white');
    tabCodex.classList.remove('text-zinc-500');
    tabStore.classList.remove('active', 'text-white');
    tabStore.classList.add('text-zinc-500');
    viewCodex.classList.remove('hidden');
    viewStore.classList.add('hidden');
});

// ==========================================
// MODAL HANDLING
// ==========================================
const openModal = (id) => document.getElementById(id)?.showModal();
const closeModal = (id) => document.getElementById(id)?.close();

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('dialog').close();
    });
});

document.getElementById('btn-open-login')?.addEventListener('click', () => openModal('modal-login'));
document.getElementById('floating-satchel')?.addEventListener('click', () => openModal('modal-satchel'));
document.getElementById('btn-open-admin')?.addEventListener('click', () => openModal('modal-admin'));

// ==========================================
// FIREBASE AUTH
// ==========================================
onAuthStateChanged(auth, (user) => {
    const btnLogin = document.getElementById('btn-open-login');
    const loggedInView = document.getElementById('logged-in-view');
    
    if (user) {
        btnLogin.classList.add('hidden');
        loggedInView.classList.remove('hidden');
        closeModal('modal-login');
    } else {
        btnLogin.classList.remove('hidden');
        loggedInView.classList.add('hidden');
    }
});

document.getElementById('auth-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => window.showToast('Access granted to Cellar.', 'success'))
        .catch(err => window.showToast(err.message, 'error'));
});

document.getElementById('btn-signout')?.addEventListener('click', () => {
    signOut(auth);
    window.showToast('Signed out successfully.', 'success');
});

// ==========================================
// CORE DATA RENDERING
// ==========================================

// 1. Render Storefront Catalog
function renderStore() {
    const grid = document.getElementById('catalog-grid');
    const filters = document.getElementById('category-filters');
    if (!grid || !filters) return;

    const potionArray = Object.entries(state.potions).map(([id, p]) => ({ id, ...p }));
    
    // Build Categories
    const categories = ['All', ...new Set(potionArray.map(p => p.category || 'General'))];
    filters.innerHTML = categories.map(cat => `
        <button class="px-3 py-1 text-xs rounded-full border ${state.selectedCategory === cat ? 'bg-purple-900 border-purple-700 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'} cat-filter" data-cat="${cat}">
            ${cat}
        </button>
    `).join('');

    document.querySelectorAll('.cat-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.selectedCategory = e.target.dataset.cat;
            renderStore();
        });
    });

    // Filter & Render Potions
    let filtered = potionArray.filter(p => !p.hidden);
    if (state.selectedCategory !== 'All') {
        filtered = filtered.filter(p => (p.category || 'General') === state.selectedCategory);
    }
    if (state.searchQuery) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(state.searchQuery));
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="text-zinc-500 text-sm col-span-full">No potions found.</p>`;
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between hover:border-purple-900 transition-colors">
            <div>
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-bold text-purple-500 uppercase tracking-wider">${p.category || 'General'}</span>
                    <span class="font-mono text-purple-300 font-bold">${p.salePrice || 0}g</span>
                </div>
                <h3 class="text-lg font-bold text-zinc-100 mb-1">${p.name}</h3>
                <p class="text-xs text-zinc-400 mb-4 line-clamp-3">${p.description || 'A mysterious brew.'}</p>
            </div>
            <button onclick="addToSatchel('${p.id}')" class="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-1.5 rounded text-sm text-zinc-200 transition-colors">+ Add to Satchel</button>
        </div>
    `).join('');
}

document.getElementById('store-search')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderStore();
});

// 2. Satchel & Webhook Ordering
window.addToSatchel = (potionId) => {
    const existing = state.satchel.find(i => i.id === potionId);
    if (existing) existing.qty++;
    else state.satchel.push({ id: potionId, qty: 1 });
    
    renderSatchel();
    window.showToast("Added to satchel.");
};

window.removeFromSatchel = (index) => {
    state.satchel.splice(index, 1);
    renderSatchel();
};

function renderSatchel() {
    const floatBtn = document.getElementById('floating-satchel');
    const countSpan = document.getElementById('satchel-count');
    const itemsDiv = document.getElementById('satchel-items');
    const totalSpan = document.getElementById('satchel-total');
    
    const totalQty = state.satchel.reduce((sum, item) => sum + item.qty, 0);
    
    if (totalQty > 0) floatBtn?.classList.remove('hidden');
    else floatBtn?.classList.add('hidden');
    
    if (countSpan) countSpan.innerText = totalQty;

    if (!itemsDiv) return;
    
    if (state.satchel.length === 0) {
        itemsDiv.innerHTML = `<p class="text-zinc-500 text-sm">Satchel is empty.</p>`;
        if(totalSpan) totalSpan.innerText = "0.0";
        return;
    }

    let totalCost = 0;
    itemsDiv.innerHTML = state.satchel.map((item, index) => {
        const p = state.potions[item.id];
        if (!p) return '';
        const lineTotal = (p.salePrice || 0) * item.qty;
        totalCost += lineTotal;

        return `
            <div class="flex justify-between items-center bg-zinc-950 border border-zinc-800 p-2 rounded">
                <div class="flex-1">
                    <div class="font-bold text-sm">${p.name}</div>
                    <div class="text-xs text-zinc-500">${p.salePrice}g each</div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-mono">x${item.qty}</span>
                    <span class="text-sm font-mono text-purple-400">${lineTotal}g</span>
                    <button onclick="removeFromSatchel(${index})" class="text-red-500 hover:text-red-400 font-bold px-2">✕</button>
                </div>
            </div>
        `;
    }).join('');

    if (totalSpan) totalSpan.innerText = totalCost.toFixed(1);
}

document.getElementById('order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.satchel.length === 0) return window.showToast("Satchel is empty.", "error");
    
    if (DISCORD_WEBHOOK_URL.includes("PLACEHOLDER") || DISCORD_WEBHOOK_URL.includes("__DISCORD_WEBHOOK")) {
        return window.showToast("Discord Webhook not configured in environment.", "error");
    }

    const name = document.getElementById('order-name').value;
    const discord = document.getElementById('order-discord').value;
    const notes = document.getElementById('order-notes').value;

    let orderLines = [];
    let total = 0;
    state.satchel.forEach(item => {
        const p = state.potions[item.id];
        if(p) {
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

    try {
        const res = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok || res.status === 204) {
            window.showToast("Order dispatched to Discord!", "success");
            state.satchel = [];
            renderSatchel();
            closeModal('modal-satchel');
            e.target.reset();
        } else {
            window.showToast(`Error dispatching: ${res.status}`, "error");
        }
    } catch(err) {
        window.showToast("Network error.", "error");
    }
});

// 3. Guest Missive
document.getElementById('missive-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (DISCORD_WEBHOOK_URL.includes("PLACEHOLDER") || DISCORD_WEBHOOK_URL.includes("__DISCORD_WEBHOOK")) {
        return window.showToast("Discord Webhook not configured.", "error");
    }

    const author = document.getElementById('missive-author').value;
    const type = document.getElementById('missive-type').value;
    const content = document.getElementById('missive-content').value;

    let contentMessage = type === 'price' 
        ? `💰 **Codex Price Missive**\nFrom: ${author}\n\n${content}`
        : `📜 **Codex Letter**\nFrom: ${author}\n\n"${content}"`;

    try {
        const res = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: contentMessage })
        });
        if (res.ok || res.status === 204) {
            window.showToast("Missive dispatched to the keeper.", "success");
            e.target.reset();
        }
    } catch(err) {
        window.showToast("Network error.", "error");
    }
});

// ==========================================
// ADMIN DATABASE WRITES (BASIC EXAMPLES)
// ==========================================
document.getElementById('admin-add-potion')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = Date.now().toString();
    set(ref(db, `potions/${id}`), {
        name: document.getElementById('add-pot-name').value,
        category: document.getElementById('add-pot-cat').value || 'General',
        salePrice: parseFloat(document.getElementById('add-pot-price').value),
        hidden: false
    }).then(() => {
        window.showToast("Potion added.", "success");
        e.target.reset();
    });
});

document.getElementById('admin-add-ingredient')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = Date.now().toString();
    set(ref(db, `ingredients/${id}`), {
        name: document.getElementById('add-ing-name').value,
        price: parseFloat(document.getElementById('add-ing-price').value || 0)
    }).then(() => {
        window.showToast("Ingredient added.", "success");
        e.target.reset();
    });
});


// ==========================================
// FIREBASE LISTENERS
// ==========================================
onValue(ref(db, 'potions'), (snapshot) => {
    state.potions = snapshot.val() || {};
    renderStore();
    
    // Update Batch Simulator Dropdown
    const select = document.getElementById('batch-potion-select');
    if (select) {
        select.innerHTML = '<option value="">Select Potion...</option>' + 
            Object.entries(state.potions).map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('');
    }
});

onValue(ref(db, 'ingredients'), (snapshot) => {
    state.ingredients = snapshot.val() || {};
    
    // Render to Codex Price List
    const priceList = document.getElementById('price-list');
    if (!priceList) return;
    
    const ings = Object.values(state.ingredients);
    if(ings.length === 0) {
        priceList.innerHTML = `<p class="text-zinc-500 text-sm col-span-full">No ingredients logged yet.</p>`;
        return;
    }
    
    priceList.innerHTML = ings.map(ing => `
        <div class="bg-zinc-950 border border-zinc-800 p-3 rounded flex justify-between items-center">
            <span class="text-sm font-bold">${ing.name}</span>
            <span class="text-sm font-mono text-zinc-400">~${ing.price || 'Unknown'}g</span>
        </div>
    `).join('');
});