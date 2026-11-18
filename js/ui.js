import {
    state,
    setCategory,
    setSearchQuery,
    addSatchelItem,
    removeSatchelItem,
    clearSatchel,
    addBatchItem,
    removeBatchItem
} from "./state.js";
import {
    loginUser,
    logoutUser,
    createPotion,
    createIngredient,
    updateIngredientStock,
    dispatchOrder
} from "./services.js";

function escapeHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

let recipeRowId = 0;
let isUserSignedIn = false;

// ==========================================
// TOAST SYSTEM
// ==========================================
export function showToast(message, type = 'success') {
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
}

// ==========================================
// MODALS & NAVIGATION
// ==========================================
export function openModal(id) {
    document.getElementById(id)?.showModal();
}

export function closeModal(id) {
    document.getElementById(id)?.close();
}

function activateTab(activeTab, inactiveTab, activeView, inactiveView) {
    activeTab.classList.add('active', 'text-white');
    activeTab.classList.remove('text-zinc-500');
    inactiveTab.classList.remove('active', 'text-white');
    inactiveTab.classList.add('text-zinc-500');
    activeView.classList.remove('hidden');
    inactiveView.classList.add('hidden');
    document.getElementById('view-admin')?.classList.add('hidden');
    document.getElementById('admin-entry')?.classList.toggle('hidden', !isUserSignedIn);
}

function openAdminPage() {
    if (!isUserSignedIn) return;

    document.getElementById('tab-store')?.classList.remove('active', 'text-white');
    document.getElementById('tab-store')?.classList.add('text-zinc-500');
    document.getElementById('tab-codex')?.classList.remove('active', 'text-white');
    document.getElementById('tab-codex')?.classList.add('text-zinc-500');
    document.getElementById('view-store')?.classList.add('hidden');
    document.getElementById('view-codex')?.classList.add('hidden');
    document.getElementById('view-admin')?.classList.remove('hidden');
    document.getElementById('admin-entry')?.classList.add('hidden');
}

export function updateAuthUI(user) {
    const btnLogin = document.getElementById('btn-open-login');
    const loggedInView = document.getElementById('logged-in-view');
    const adminAccess = document.getElementById('admin-access');
    const adminEntry = document.getElementById('admin-entry');
    isUserSignedIn = Boolean(user);

    if (user) {
        btnLogin?.classList.add('hidden');
        loggedInView?.classList.remove('hidden');
        adminAccess?.classList.remove('hidden');
        adminEntry?.classList.remove('hidden');
        closeModal('modal-login');
    } else {
        btnLogin?.classList.remove('hidden');
        loggedInView?.classList.add('hidden');
        adminAccess?.classList.add('hidden');
        adminEntry?.classList.add('hidden');
        if (!document.getElementById('view-admin')?.classList.contains('hidden')) {
            activateTab(
                document.getElementById('tab-store'),
                document.getElementById('tab-codex'),
                document.getElementById('view-store'),
                document.getElementById('view-codex')
            );
        }
    }
}

// ==========================================
// RENDERERS
// ==========================================
export function renderStore() {
    const grid = document.getElementById('catalog-grid');
    const filters = document.getElementById('category-filters');
    if (!grid || !filters) return;

    const potionArray = Object.entries(state.potions).map(([id, p]) => ({ id, ...p }));
    const categories = ['All', ...new Set(potionArray.map((p) => p.category || 'General'))];

    filters.innerHTML = categories.map((cat) => `
        <button type="button" class="px-3 py-1 text-xs rounded-full border ${state.selectedCategory === cat ? 'bg-purple-900 border-purple-700 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'} cat-filter" data-cat="${escapeHTML(cat)}">
            ${escapeHTML(cat)}
        </button>
    `).join('');

    let filtered = potionArray.filter((p) => !p.hidden);
    if (state.selectedCategory !== 'All') {
        filtered = filtered.filter((p) => (p.category || 'General') === state.selectedCategory);
    }
    if (state.searchQuery) {
        filtered = filtered.filter((p) => p.name.toLowerCase().includes(state.searchQuery));
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="text-zinc-500 text-sm col-span-full">No potions found.</p>`;
        return;
    }

    grid.innerHTML = filtered.map((p) => `
        <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between hover:border-purple-900 transition-colors">
            <div>
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-bold text-purple-500 uppercase tracking-wider">${escapeHTML(p.category || 'General')}</span>
                    <span class="font-mono text-purple-300 font-bold">${p.salePrice || 0}g</span>
                </div>
                <h3 class="text-lg font-bold text-zinc-100 mb-1">${escapeHTML(p.name)}</h3>
                <p class="text-xs text-zinc-400 mb-4 line-clamp-3">${escapeHTML(p.description || 'A mysterious brew.')}</p>
            </div>
            <button type="button" data-action="add-satchel" data-id="${escapeHTML(p.id)}" class="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-1.5 rounded text-sm text-zinc-200 transition-colors">+ Add to Satchel</button>
        </div>
    `).join('');
}

export function renderSatchel() {
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
        if (totalSpan) totalSpan.innerText = "0.0";
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
                    <div class="font-bold text-sm">${escapeHTML(p.name)}</div>
                    <div class="text-xs text-zinc-500">${p.salePrice}g each</div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-mono">x${item.qty}</span>
                    <span class="text-sm font-mono text-purple-400">${lineTotal}g</span>
                    <button type="button" data-action="remove-satchel" data-index="${index}" class="text-red-500 hover:text-red-400 font-bold px-2">✕</button>
                </div>
            </div>
        `;
    }).join('');

    if (totalSpan) totalSpan.innerText = totalCost.toFixed(1);
}

export function renderPriceList() {
    const priceList = document.getElementById('price-list');
    if (!priceList) return;

    const ings = Object.entries(state.ingredients);
    if (ings.length === 0) {
        priceList.innerHTML = `<p class="text-zinc-500 text-sm col-span-full">No ingredients logged yet.</p>`;
        return;
    }

    priceList.innerHTML = ings.map(([id, ingredient]) => `
        <button type="button" data-action="show-ingredient-potions" data-id="${escapeHTML(id)}" aria-label="Show potions that use ${escapeHTML(ingredient.name)}" class="w-full bg-zinc-950 border border-zinc-800 p-3 rounded flex justify-between items-center text-left hover:border-purple-800 transition-colors">
            <span class="text-sm font-bold">${escapeHTML(ingredient.name)}</span>
            <span class="text-sm font-mono text-zinc-400">~${ingredient.price ?? 'Unknown'}g</span>
        </button>
    `).join('');
}

export function renderInventory() {
    const ingredientList = document.getElementById('ingredient-inventory');
    const ingredientCount = document.getElementById('ingredient-stock-count');
    if (!ingredientList) return;

    const ingredients = Object.entries(state.ingredients);
    if (ingredientCount) ingredientCount.innerText = `${ingredients.length} items`;

    ingredientList.innerHTML = ingredients.length ? ingredients.map(([id, ingredient]) => `
        <form data-action="save-ingredient-stock" data-id="${escapeHTML(id)}" class="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div class="min-w-0 flex-1">
                <p class="font-semibold text-sm truncate">${escapeHTML(ingredient.name)}</p>
                <p class="text-xs text-zinc-500">Base value · ${ingredient.price || 0}g</p>
            </div>
            <label class="sr-only" for="ingredient-stock-${escapeHTML(id)}">Available stock (whole units) for ${escapeHTML(ingredient.name)}</label>
            <input id="ingredient-stock-${escapeHTML(id)}" name="stock" aria-label="Available stock (whole units) for ${escapeHTML(ingredient.name)}" type="number" min="0" step="1" required value="${Number.isSafeInteger(ingredient.stock) ? ingredient.stock : 0}" class="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-sm text-center">
            <button type="submit" class="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-2 rounded text-xs">Save</button>
        </form>
    `).join('') : '<p class="text-zinc-500 text-sm">No ingredients in the cellar.</p>';
}

export function renderRecipeIngredients() {
    const recipeList = document.getElementById('recipe-ingredients');
    if (!recipeList) return;

    const options = Object.entries(state.ingredients)
        .map(([id, ingredient]) => `<option value="${escapeHTML(id)}">${escapeHTML(ingredient.name)}</option>`)
        .join('');
    recipeList.querySelectorAll('.recipe-ingredient-select').forEach((select) => {
        const selectedId = select.value;
        select.innerHTML = `<option value="">Choose an ingredient...</option>${options}`;
        if (state.ingredients[selectedId]) select.value = selectedId;
    });
}

function addRecipeIngredientRow() {
    const recipeList = document.getElementById('recipe-ingredients');
    if (!recipeList) return;

    const rowId = ++recipeRowId;
    const row = document.createElement('div');
    row.dataset.recipeRow = 'true';
    row.className = 'grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_8rem_auto] gap-2 items-end bg-zinc-950 border border-zinc-800 rounded-lg p-3';
    row.innerHTML = `
        <div>
            <label for="recipe-ingredient-${rowId}" class="block text-xs text-zinc-400 mb-1">Ingredient</label>
            <select id="recipe-ingredient-${rowId}" name="recipeIngredient" required class="recipe-ingredient-select w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"></select>
        </div>
        <div>
            <label for="recipe-quantity-${rowId}" class="block text-xs text-zinc-400 mb-1">Units per potion</label>
            <input id="recipe-quantity-${rowId}" name="recipeQuantity" type="number" min="1" step="1" value="1" required class="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm">
        </div>
        <button type="button" data-action="remove-recipe-ingredient" aria-label="Remove ingredient from recipe" class="justify-self-end rounded border border-zinc-700 px-3 py-2 text-zinc-400 hover:text-red-400" title="Remove ingredient">−</button>
    `;
    recipeList.appendChild(row);
    renderRecipeIngredients();
}

function showIngredientPotions(ingredientId) {
    const ingredient = state.ingredients[ingredientId];
    if (!ingredient) return;

    const title = document.getElementById('ingredient-potion-title');
    const list = document.getElementById('ingredient-potion-list');
    if (!title || !list) return;

    title.innerText = `Potions using ${ingredient.name}`;
    const matches = Object.entries(state.potions).filter(([, potion]) => (
        !potion.hidden &&
        Number.isSafeInteger(potion.ingredients?.[ingredientId]) &&
        potion.ingredients[ingredientId] > 0
    ));

    list.innerHTML = matches.length ? matches.map(([, potion]) => `
            <div class="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between gap-4">
                <div>
                    <p class="font-semibold">${escapeHTML(potion.name)}</p>
                    <p class="text-xs text-zinc-500">${escapeHTML(potion.category || 'General')} · ${potion.ingredients[ingredientId]} units per potion</p>
                </div>
                <span class="text-xs text-purple-300">Custom orders welcome</span>
            </div>
        `).join('') : '<p class="text-sm text-zinc-400">No listed potions currently use this ingredient.</p>';

    openModal('modal-ingredient-potions');
}

export function renderBatchSelect() {
    const select = document.getElementById('batch-potion-select');
    if (!select) return;

    select.innerHTML = '<option value="">Select Potion...</option>' +
        Object.entries(state.potions)
            .map(([id, p]) => `<option value="${escapeHTML(id)}">${escapeHTML(p.name)}</option>`)
            .join('');
}

export function renderBatchQueue() {
    const queueDiv = document.getElementById('batch-queue');
    const resultsDiv = document.getElementById('batch-results');
    if (!queueDiv || !resultsDiv) return;

    if (state.batchQueue.length === 0) {
        queueDiv.innerHTML = '';
        resultsDiv.innerText = 'Results will appear here.';
        return;
    }

    let totalUnits = 0;
    let totalGold = 0;
    const summaryLines = [];

    queueDiv.innerHTML = state.batchQueue.map((item, index) => {
        const p = state.potions[item.id];
        if (!p) return '';
        const lineValue = (p.salePrice || 0) * item.qty;
        totalUnits += item.qty;
        totalGold += lineValue;
        summaryLines.push(`• ${item.qty}x ${p.name} (${lineValue}g)`);

        return `
            <span class="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-2.5 py-1 rounded text-xs">
                <span>${item.qty}x ${escapeHTML(p.name)}</span>
                <button type="button" data-action="remove-batch" data-index="${index}" class="text-zinc-400 hover:text-red-400">✕</button>
            </span>
        `;
    }).join('');

    resultsDiv.innerText = `${summaryLines.join('\n')}\n\nTotal Brews: ${totalUnits} | Estimated Value: ${totalGold}g`;
}

// ==========================================
// EVENT BINDINGS
// ==========================================
export function initUI() {
    const tabStore = document.getElementById('tab-store');
    const tabCodex = document.getElementById('tab-codex');
    const viewStore = document.getElementById('view-store');
    const viewCodex = document.getElementById('view-codex');

    tabStore.addEventListener('click', () => activateTab(tabStore, tabCodex, viewStore, viewCodex));
    tabCodex.addEventListener('click', () => activateTab(tabCodex, tabStore, viewCodex, viewStore));

    // Modal triggers & close buttons
    document.querySelectorAll('.close-modal').forEach((btn) => {
        btn.addEventListener('click', (e) => e.target.closest('dialog')?.close());
    });

    document.getElementById('price-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="show-ingredient-potions"]');
        if (btn) showIngredientPotions(btn.dataset.id);
    });

    document.getElementById('btn-open-login')?.addEventListener('click', () => openModal('modal-login'));
    document.getElementById('floating-satchel')?.addEventListener('click', () => openModal('modal-satchel'));
    document.getElementById('btn-open-admin-page')?.addEventListener('click', openAdminPage);
    document.getElementById('btn-admin-back')?.addEventListener('click', () => tabStore.click());
    document.getElementById('btn-add-recipe-ingredient')?.addEventListener('click', addRecipeIngredientRow);
    document.getElementById('recipe-ingredients')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="remove-recipe-ingredient"]');
        if (btn) btn.closest('[data-recipe-row]')?.remove();
    });

    // Authentication
    document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        try {
            await loginUser(email, pass);
            showToast('Access granted to Cellar.', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    document.getElementById('btn-signout')?.addEventListener('click', () => {
        logoutUser();
        showToast('Signed out successfully.', 'success');
    });

    // Store search & delegated category/satchel clicks
    document.getElementById('store-search')?.addEventListener('input', (e) => {
        setSearchQuery(e.target.value);
        renderStore();
    });

    document.getElementById('category-filters')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.cat-filter');
        if (!btn) return;
        setCategory(btn.dataset.cat);
        renderStore();
    });

    document.getElementById('catalog-grid')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="add-satchel"]');
        if (!btn) return;
        addSatchelItem(btn.dataset.id);
        renderSatchel();
        showToast('Added to satchel.');
    });

    document.getElementById('satchel-items')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="remove-satchel"]');
        if (!btn) return;
        removeSatchelItem(Number(btn.dataset.index));
        renderSatchel();
    });

    // Satchel order submission
    document.getElementById('order-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.satchel.length === 0) {
            showToast('Satchel is empty.', 'error');
            return;
        }

        try {
            await dispatchOrder({
                name: document.getElementById('order-name').value,
                discord: document.getElementById('order-discord').value,
                notes: document.getElementById('order-notes').value,
                satchel: state.satchel,
                potions: state.potions
            });
            showToast('Order dispatched to Discord!', 'success');
            clearSatchel();
            renderSatchel();
            closeModal('modal-satchel');
            e.target.reset();
        } catch (err) {
            if (err.message === 'WEBHOOK_UNCONFIGURED') {
                showToast('Discord Webhook not configured in environment.', 'error');
            } else if (err.message.startsWith('HTTP_')) {
                showToast(`Error dispatching: ${err.message.replace('HTTP_', '')}`, 'error');
            } else {
                showToast('Network error.', 'error');
            }
        }
    });

    // Admin batch simulator
    document.getElementById('btn-add-batch')?.addEventListener('click', () => {
        const potionId = document.getElementById('batch-potion-select')?.value;
        const qty = Number(document.getElementById('batch-qty')?.value);
        if (!potionId || !Number.isSafeInteger(qty) || qty < 1) return;
        addBatchItem(potionId, qty);
        renderBatchQueue();
    });

    document.getElementById('batch-queue')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="remove-batch"]');
        if (!btn) return;
        removeBatchItem(Number(btn.dataset.index));
        renderBatchQueue();
    });

    // Admin database forms
    document.getElementById('admin-add-potion')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const recipe = {};
        for (const row of document.querySelectorAll('#recipe-ingredients [data-recipe-row]')) {
            const ingredientId = row.querySelector('.recipe-ingredient-select').value;
            const quantity = Number(row.querySelector('[name="recipeQuantity"]').value);
            if (!ingredientId || !Number.isSafeInteger(quantity) || quantity < 1) {
                showToast('Choose an ingredient and enter a whole-number recipe amount.', 'error');
                return;
            }
            recipe[ingredientId] = (recipe[ingredientId] || 0) + quantity;
            if (!Number.isSafeInteger(recipe[ingredientId])) {
                showToast('Recipe ingredient total is too large.', 'error');
                return;
            }
        }

        try {
            await createPotion({
                name: document.getElementById('add-pot-name').value,
                category: document.getElementById('add-pot-cat').value,
                salePrice: Number(document.getElementById('add-pot-price').value),
                ingredients: recipe
            });
            showToast('Potion added.', 'success');
            e.target.reset();
            document.getElementById('recipe-ingredients').innerHTML = '';
        } catch (err) {
            showToast(`Could not add potion: ${err.message}`, 'error');
        }
    });

    document.getElementById('admin-add-ingredient')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await createIngredient({
                name: document.getElementById('add-ing-name').value,
                price: Number(document.getElementById('add-ing-price').value),
                stock: Number(document.getElementById('add-ing-stock').value)
            });
            showToast('Ingredient added.', 'success');
            e.target.reset();
        } catch (err) {
            showToast(`Could not add ingredient: ${err.message}`, 'error');
        }
    });

    document.getElementById('ingredient-inventory')?.addEventListener('submit', async (e) => {
        const form = e.target.closest('[data-action="save-ingredient-stock"]');
        if (!form) return;
        e.preventDefault();
        try {
            await updateIngredientStock(form.dataset.id, Number(form.elements.stock.value));
            showToast('Ingredient stock updated.');
        } catch (err) {
            showToast(`Could not update ingredient stock: ${err.message}`, 'error');
        }
    });

}