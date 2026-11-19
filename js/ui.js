import {
    state,
    setCategory,
    setCodexCategory,
    setSearchQuery,
    addSatchelItem,
    removeSatchelItem,
    setSatchelItemQuantity,
    clearSatchel,
    addBatchItem,
    removeBatchItem,
    clearBatchQueue
} from "./state.js";
import {
    loginUser,
    logoutUser,
    createPotion,
    createIngredient,
    updatePotion,
    updateIngredient,
    increaseIngredientStock,
    dispatchOrder,
    deletePotion,
    deleteIngredient,
    brewBatch
} from "./services.js";

function escapeHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getDataStatusMessage(label, loaded, error) {
    if (error) {
        return `<p role="alert" class="col-span-full text-sm text-red-300">Could not load ${escapeHTML(label)}: ${escapeHTML(error)}</p>`;
    }
    if (!loaded) {
        return `<div role="status" class="col-span-full flex items-center gap-3 text-sm text-zinc-400"><span aria-hidden="true" class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-purple-400"></span>Loading ${escapeHTML(label)}...</div>`;
    }
    return '';
}

function sortEntriesByName(entries) {
    return entries.sort((left, right) => String(left[1].name || '')
        .localeCompare(String(right[1].name || ''), undefined, { sensitivity: 'base' }));
}

let recipeRowId = 0;
let isUserSignedIn = false;
let pendingDelete = null;
let isBatchBrewing = false;

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
}

function activatePanelTab(activeTab, inactiveTab, activePanel, inactivePanel) {
    activeTab.classList.add('active', 'text-white');
    activeTab.classList.remove('text-zinc-500');
    activeTab.setAttribute('aria-selected', 'true');
    inactiveTab.classList.remove('active', 'text-white');
    inactiveTab.classList.add('text-zinc-500');
    inactiveTab.setAttribute('aria-selected', 'false');
    activePanel.classList.remove('hidden');
    inactivePanel.classList.add('hidden');
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
}

export function updateAuthUI(user) {
    const btnLogin = document.getElementById('btn-open-login');
    const loggedInView = document.getElementById('logged-in-view');
    const adminAccess = document.getElementById('admin-access');
    isUserSignedIn = Boolean(user);

    if (user) {
        btnLogin?.classList.add('hidden');
        loggedInView?.classList.remove('hidden');
        adminAccess?.classList.remove('hidden');
        closeModal('modal-login');
    } else {
        btnLogin?.classList.remove('hidden');
        loggedInView?.classList.add('hidden');
        adminAccess?.classList.add('hidden');
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

    const dataStatus = getDataStatusMessage('potions', state.potionsLoaded, state.potionsLoadError);
    if (dataStatus) {
        filters.innerHTML = '';
        grid.innerHTML = dataStatus;
        return;
    }

    const potionArray = Object.entries(state.potions)
        .map(([id, p]) => ({ id, ...p }))
        .filter((p) => !p.hidden)
        .sort((left, right) => {
            const priceDifference = (Number.isFinite(left.salePrice) ? left.salePrice : 0) -
                (Number.isFinite(right.salePrice) ? right.salePrice : 0);
            return priceDifference || String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base' });
        });
    const storefrontPotions = potionArray;
    const categories = ['All', ...new Set(storefrontPotions.map((p) => p.category || 'General'))];
    if (!categories.includes(state.selectedCategory)) setCategory('All');

    filters.innerHTML = categories.map((cat) => `
        <button type="button" class="px-3 py-1 text-xs rounded-full border ${state.selectedCategory === cat ? 'bg-purple-900 border-purple-700 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'} cat-filter" data-cat="${escapeHTML(cat)}">
            ${escapeHTML(cat)}
        </button>
    `).join('');

    let filtered = storefrontPotions;
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
                ${p.description ? `<p class="text-xs text-zinc-400 mb-4 line-clamp-3">${escapeHTML(p.description)}</p>` : ''}
            </div>
            <div class="flex gap-2">
                <div class="flex items-center rounded border border-zinc-800 bg-zinc-950">
                    <button type="button" data-action="adjust-store-quantity" data-delta="-1" aria-label="Decrease quantity of ${escapeHTML(p.name)}" class="px-2 py-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">−</button>
                    <input type="number" min="1" step="1" value="1" aria-label="Quantity of ${escapeHTML(p.name)}" class="w-12 bg-transparent px-1 py-1.5 text-sm text-center">
                    <button type="button" data-action="adjust-store-quantity" data-delta="1" aria-label="Increase quantity of ${escapeHTML(p.name)}" class="px-2 py-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">+</button>
                </div>
                <button type="button" data-action="add-satchel" data-id="${escapeHTML(p.id)}" class="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-1.5 rounded text-sm text-zinc-200 transition-colors">Add to Satchel</button>
            </div>
        </div>
    `).join('');
}

function renderSatchelSummary() {
    const floatBtn = document.getElementById('floating-satchel');
    const countSpan = document.getElementById('satchel-count');
    const totalSpan = document.getElementById('satchel-total');
    const totalQty = state.satchel.reduce((sum, item) => sum + item.qty, 0);

    if (totalQty > 0) floatBtn?.classList.remove('hidden');
    else floatBtn?.classList.add('hidden');
    if (countSpan) countSpan.innerText = totalQty;

    const totalCost = state.satchel.reduce((sum, item) => {
        const potion = state.potions[item.id];
        return potion ? sum + (potion.salePrice || 0) * item.qty : sum;
    }, 0);
    if (totalSpan) totalSpan.innerText = totalCost.toFixed(1);
}

function adjustQuantityInput(button) {
    const input = button.parentElement.querySelector('input[type="number"]');
    const currentQuantity = Number(input.value);
    const baseQuantity = Number.isSafeInteger(currentQuantity) && currentQuantity >= 1 ? currentQuantity : 1;
    const updatedQuantity = baseQuantity + Number(button.dataset.delta);
    if (!Number.isSafeInteger(updatedQuantity)) {
        showToast('Quantity is too large.', 'error');
        return;
    }
    input.value = Math.max(1, updatedQuantity);
}

function updateSatchelQuantityFromInput(input) {
    const index = Number(input.dataset.index);
    const quantity = Number(input.value);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || !state.satchel[index]) return false;

    setSatchelItemQuantity(index, quantity);
    const item = state.satchel[index];
    const potion = state.potions[item.id];
    const entry = input.closest('[data-satchel-entry]');
    if (potion && entry) {
        entry.querySelector('[data-line-total]').innerText = `${(potion.salePrice || 0) * quantity}g`;
    }
    renderSatchelSummary();
    return true;
}

export function renderSatchel() {
    const itemsDiv = document.getElementById('satchel-items');
    renderSatchelSummary();
    if (!itemsDiv) return;

    if (state.satchel.length === 0) {
        itemsDiv.innerHTML = `<p class="text-zinc-500 text-sm">Satchel is empty.</p>`;
        return;
    }

    itemsDiv.innerHTML = state.satchel.map((item, index) => {
        const p = state.potions[item.id];
        if (!p) return '';
        const lineTotal = (p.salePrice || 0) * item.qty;

        return `
            <div data-satchel-entry class="flex flex-col gap-3 bg-zinc-950 border border-zinc-800 p-2 rounded sm:flex-row sm:items-center sm:justify-between">
                <div class="flex-1">
                    <div class="font-bold text-sm">${escapeHTML(p.name)}</div>
                    <div class="text-xs text-zinc-500">${p.salePrice}g each</div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="flex items-center rounded border border-zinc-800 bg-zinc-900">
                        <button type="button" data-action="adjust-satchel-quantity" data-index="${index}" data-delta="-1" aria-label="Decrease ${escapeHTML(p.name)} quantity" ${item.qty <= 1 ? 'disabled' : ''} class="px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">−</button>
                        <input type="number" min="1" step="1" value="${item.qty}" data-action="set-satchel-quantity" data-index="${index}" aria-label="Quantity of ${escapeHTML(p.name)} in satchel" class="w-12 bg-transparent px-1 py-1 text-sm text-center">
                        <button type="button" data-action="adjust-satchel-quantity" data-index="${index}" data-delta="1" aria-label="Increase ${escapeHTML(p.name)} quantity" class="px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white">+</button>
                    </div>
                    <span data-line-total class="text-sm font-mono text-purple-400">${lineTotal}g</span>
                    <button type="button" data-action="remove-satchel" data-index="${index}" class="text-red-500 hover:text-red-400 font-bold px-2">✕</button>
                </div>
            </div>
        `;
    }).join('');
}

export function renderPriceList() {
    const priceList = document.getElementById('price-list');
    if (!priceList) return;

    const dataStatus = getDataStatusMessage('ingredients', state.ingredientsLoaded, state.ingredientsLoadError);
    if (dataStatus) {
        priceList.innerHTML = dataStatus;
        return;
    }

    const ings = sortEntriesByName(Object.entries(state.ingredients));
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

export function renderStoreIngredients() {
    const ingredientList = document.getElementById('store-ingredient-list');
    if (!ingredientList) return;

    const dataStatus = getDataStatusMessage('ingredients', state.ingredientsLoaded, state.ingredientsLoadError);
    if (dataStatus) {
        ingredientList.innerHTML = dataStatus;
        return;
    }

    const lowStockIngredients = sortEntriesByName(Object.entries(state.ingredients).filter(([, ingredient]) => {
        const stock = Number.isSafeInteger(ingredient.stock) ? ingredient.stock : 0;
        const threshold = Number.isSafeInteger(ingredient.restockThreshold) ? ingredient.restockThreshold : 0;
        return stock < threshold;
    }));

    if (lowStockIngredients.length === 0) {
        ingredientList.innerHTML = "<p class=\"text-zinc-500 text-sm col-span-full\">The store isn't buying anything right now.</p>";
        return;
    }

    ingredientList.innerHTML = lowStockIngredients.map(([, ingredient]) => `
            <article class="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                <div class="flex justify-between items-start gap-3">
                    <h3 class="font-bold text-zinc-100">${escapeHTML(ingredient.name)}</h3>
                    <span class="font-mono text-sm text-purple-300">~${ingredient.price ?? 'Unknown'}g</span>
                </div>
            </article>
    `).join('');
}

export function renderCodexPotions() {
    const potionList = document.getElementById('codex-potion-list');
    const filters = document.getElementById('codex-category-filters');
    if (!potionList || !filters) return;

    const dataError = state.potionsLoadError || state.ingredientsLoadError;
    const errorLabel = state.potionsLoadError ? 'potions' : 'ingredients';
    const dataStatus = getDataStatusMessage(
        errorLabel,
        state.potionsLoaded && state.ingredientsLoaded,
        dataError
    );
    if (dataStatus) {
        filters.innerHTML = '';
        potionList.innerHTML = dataStatus;
        return;
    }

    const visiblePotions = Object.entries(state.potions).filter(([, potion]) => !potion.hideFromCodex);
    const categories = ['All', ...new Set(visiblePotions.map(([, potion]) => potion.category || 'General'))];
    if (!categories.includes(state.selectedCodexCategory)) setCodexCategory('All');

    filters.innerHTML = categories.map((category) => `
        <button type="button" class="px-3 py-1 text-xs rounded-full border ${state.selectedCodexCategory === category ? 'bg-purple-900 border-purple-700 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'} codex-cat-filter" data-cat="${escapeHTML(category)}">
            ${escapeHTML(category)}
        </button>
    `).join('');

    const categoryPotions = state.selectedCodexCategory === 'All'
        ? visiblePotions
        : visiblePotions.filter(([, potion]) => (potion.category || 'General') === state.selectedCodexCategory);
    if (categoryPotions.length === 0) {
        potionList.innerHTML = visiblePotions.length
            ? '<p class="text-zinc-500 text-sm col-span-full">No potions found in this category.</p>'
            : '<p class="text-zinc-500 text-sm col-span-full">No potions logged yet.</p>';
        return;
    }

    const potions = sortEntriesByName(categoryPotions);
    potionList.innerHTML = potions.map(([, potion]) => {
        const recipe = Object.entries(potion.ingredients || {});
        return `
            <article class="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                <div class="mb-2">
                    <h3 class="font-bold text-zinc-100">${escapeHTML(potion.name)}</h3>
                    <p class="text-xs text-purple-400">${escapeHTML(potion.category || 'General')}</p>
                </div>
                <p class="text-sm text-zinc-400 whitespace-pre-wrap">${escapeHTML(potion.description || 'No description provided.')}</p>
                ${potion.hideRecipe
                    ? '<p class="mt-3 text-xs text-zinc-500">Recipe kept secret.</p>'
                    : `<div class="mt-3">
                        <h4 class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ingredients</h4>
                        ${recipe.length
                            ? `<ul class="mt-1 space-y-1 text-sm text-zinc-300">${recipe.map(([id, quantity]) => `
                                <li>${escapeHTML(state.ingredients[id]?.name || 'Unknown ingredient')} · ${escapeHTML(quantity)} units</li>
                            `).join('')}</ul>`
                            : '<p class="mt-1 text-sm text-zinc-500">No ingredients listed.</p>'}
                    </div>`}
            </article>
        `;
    }).join('');
}

export function renderInventory() {
    const potionList = document.getElementById('potion-inventory');
    const ingredientList = document.getElementById('ingredient-inventory');
    const potionCount = document.getElementById('potion-count');
    const ingredientCount = document.getElementById('ingredient-stock-count');
    if (!potionList || !ingredientList) return;

    const potions = sortEntriesByName(Object.entries(state.potions));
    const usedIngredientIds = new Set();
    Object.values(state.potions).forEach((potion) => {
        Object.entries(potion.ingredients || {}).forEach(([ingredientId, quantity]) => {
            if (Number.isSafeInteger(quantity) && quantity > 0) usedIngredientIds.add(ingredientId);
        });
    });
    const ingredients = Object.entries(state.ingredients).sort((left, right) => {
        const [leftId, leftIngredient] = left;
        const [rightId, rightIngredient] = right;
        const leftUnused = !usedIngredientIds.has(leftId);
        const rightUnused = !usedIngredientIds.has(rightId);
        if (leftUnused !== rightUnused) return leftUnused ? 1 : -1;

        const leftLowStock = (Number.isSafeInteger(leftIngredient.stock) ? leftIngredient.stock : 0) <
            (Number.isSafeInteger(leftIngredient.restockThreshold) ? leftIngredient.restockThreshold : 0);
        const rightLowStock = (Number.isSafeInteger(rightIngredient.stock) ? rightIngredient.stock : 0) <
            (Number.isSafeInteger(rightIngredient.restockThreshold) ? rightIngredient.restockThreshold : 0);
        if (leftLowStock !== rightLowStock) return leftLowStock ? -1 : 1;

        return String(leftIngredient.name || '').localeCompare(String(rightIngredient.name || ''), undefined, { sensitivity: 'base' });
    });
    if (potionCount) {
        potionCount.innerText = state.potionsLoadError ? 'Unavailable' : state.potionsLoaded ? `${potions.length} items` : 'Loading...';
    }
    if (ingredientCount) {
        ingredientCount.innerText = state.ingredientsLoadError ? 'Unavailable' : state.ingredientsLoaded ? `${ingredients.length} items` : 'Loading...';
    }

    const potionStatus = getDataStatusMessage('potions', state.potionsLoaded, state.potionsLoadError);
    potionList.innerHTML = potionStatus || (potions.length ? potions.map(([id, potion]) => `
        <div class="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div class="min-w-0 flex-1">
                <p class="font-semibold text-sm truncate">${escapeHTML(potion.name)}</p>
                <p class="text-xs text-zinc-500">${escapeHTML(potion.category || 'General')} · ${potion.salePrice || 0}g${potion.hidden ? ' · Hidden from storefront' : ''}${potion.hideRecipe ? ' · Recipe hidden in Codex' : ''}${potion.hideFromCodex ? ' · Hidden from Codex' : ''}</p>
            </div>
            <button type="button" data-action="edit-potion" data-id="${escapeHTML(id)}" aria-label="Edit ${escapeHTML(potion.name)}" title="Edit potion" class="text-lg rounded p-2 hover:bg-zinc-800">⚙️</button>
        </div>
    `).join('') : '<p class="text-zinc-500 text-sm">No potions in the cellar.</p>');

    const ingredientStatus = getDataStatusMessage('ingredients', state.ingredientsLoaded, state.ingredientsLoadError);
    ingredientList.innerHTML = ingredientStatus || (ingredients.length ? ingredients.map(([id, ingredient]) => {
        const stock = Number.isSafeInteger(ingredient.stock) ? ingredient.stock : 0;
        const threshold = Number.isSafeInteger(ingredient.restockThreshold) ? ingredient.restockThreshold : 0;
        const lowStock = stock < threshold;
        return `
        <div class="flex flex-col gap-3 rounded-lg border ${lowStock ? 'border-amber-800' : 'border-zinc-800'} bg-zinc-950 p-3 sm:flex-row sm:items-center">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                    <p class="font-semibold text-sm truncate">${escapeHTML(ingredient.name)}</p>
                    ${lowStock ? '<span class="shrink-0 rounded bg-amber-950 px-2 py-0.5 text-xs font-semibold text-amber-300">Low stock</span>' : ''}
                </div>
                <p class="text-xs text-zinc-500">${stock} units · ${ingredient.price ?? 0}g · Threshold: ${threshold}</p>
            </div>
            <div class="flex items-center gap-2">
                <input type="number" min="1" step="1" value="1" aria-label="Units to add to ${escapeHTML(ingredient.name)}" class="w-20 rounded border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-center">
                <button type="button" data-action="add-ingredient-stock" data-id="${escapeHTML(id)}" class="rounded border border-green-800 bg-green-950 px-3 py-2 text-sm font-semibold text-green-300 hover:bg-green-900">Add stock</button>
                <button type="button" data-action="edit-ingredient" data-id="${escapeHTML(id)}" aria-label="Edit ${escapeHTML(ingredient.name)}" title="Edit ingredient" class="text-lg rounded p-2 hover:bg-zinc-800">⚙️</button>
            </div>
        </div>
    `;
    }).join('') : '<p class="text-zinc-500 text-sm">No ingredients in the cellar.</p>');
}

export function renderRecipeIngredients() {
    const options = sortEntriesByName(Object.entries(state.ingredients))
        .map(([id, ingredient]) => `<option value="${escapeHTML(id)}">${escapeHTML(ingredient.name)}</option>`)
        .join('');
    const placeholder = state.ingredientsLoadError
        ? 'Could not load ingredients'
        : state.ingredientsLoaded ? 'Choose an ingredient...' : 'Loading ingredients...';
    document.querySelectorAll('.recipe-ingredients-list .recipe-ingredient-select').forEach((select) => {
        const selectedId = select.value;
        select.disabled = !state.ingredientsLoaded || Boolean(state.ingredientsLoadError);
        select.innerHTML = `<option value="">${placeholder}</option>${options}`;
        if (state.ingredients[selectedId]) select.value = selectedId;
    });
}

function addRecipeIngredientRow(listId, ingredientId = '', quantity = 1) {
    const recipeList = document.getElementById(listId);
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
    row.querySelector('.recipe-ingredient-select').value = ingredientId;
    row.querySelector('[name="recipeQuantity"]').value =
        Number.isSafeInteger(quantity) && quantity > 0 ? quantity : '';
}

function showIngredientPotions(ingredientId) {
    const ingredient = state.ingredients[ingredientId];
    if (!ingredient) return;

    const title = document.getElementById('ingredient-potion-title');
    const list = document.getElementById('ingredient-potion-list');
    if (!title || !list) return;

    title.innerText = `Potions using ${ingredient.name}`;
    const matches = Object.entries(state.potions).filter(([, potion]) => (
        !potion.hideFromCodex &&
        !potion.hideRecipe &&
        Number.isSafeInteger(potion.ingredients?.[ingredientId]) &&
        potion.ingredients[ingredientId] > 0
    ));

    list.innerHTML = matches.length ? matches.map(([, potion]) => `
            <div class="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between gap-4">
                <div>
                    <p class="font-semibold">${escapeHTML(potion.name)}</p>
                    <p class="text-xs text-zinc-500">${escapeHTML(potion.category || 'General')} · ${potion.ingredients[ingredientId]} units per potion</p>
                </div>
            </div>
        `).join('') : '<p class="text-sm text-zinc-400">No listed potions currently use this ingredient.</p>';

    openModal('modal-ingredient-potions');
}

function collectRecipe(listId) {
    const recipe = {};
    for (const row of document.querySelectorAll(`#${listId} [data-recipe-row]`)) {
        const ingredientId = row.querySelector('.recipe-ingredient-select').value;
        const quantity = Number(row.querySelector('[name="recipeQuantity"]').value);
        if (!ingredientId || !Number.isSafeInteger(quantity) || quantity < 1) {
            showToast('Choose an ingredient and enter a whole-number recipe amount.', 'error');
            return null;
        }
        recipe[ingredientId] = (recipe[ingredientId] || 0) + quantity;
        if (!Number.isSafeInteger(recipe[ingredientId])) {
            showToast('Recipe ingredient total is too large.', 'error');
            return null;
        }
    }
    return recipe;
}

function openPotionEditor(id) {
    const potion = state.potions[id];
    if (!potion) return;

    document.getElementById('edit-pot-id').value = id;
    document.getElementById('edit-pot-name').value = potion.name || '';
    document.getElementById('edit-pot-cat').value = potion.category || '';
    document.getElementById('edit-pot-description').value = potion.description || '';
    document.getElementById('edit-pot-price').value = potion.salePrice ?? 0;
    document.getElementById('edit-pot-hidden').checked = Boolean(potion.hidden);
    document.getElementById('edit-pot-hide-recipe').checked = Boolean(potion.hideRecipe);
    document.getElementById('edit-pot-hide-codex').checked = Boolean(potion.hideFromCodex);
    const recipeList = document.getElementById('edit-pot-recipe-ingredients');
    recipeList.innerHTML = '';
    Object.entries(potion.ingredients || {}).forEach(([ingredientId, quantity]) => {
        addRecipeIngredientRow(recipeList.id, ingredientId, quantity);
    });
    openModal('modal-edit-potion');
}

function openIngredientEditor(id) {
    const ingredient = state.ingredients[id];
    if (!ingredient) return;

    document.getElementById('edit-ing-id').value = id;
    document.getElementById('edit-ing-name').value = ingredient.name || '';
    document.getElementById('edit-ing-price').value = ingredient.price ?? 0;
    document.getElementById('edit-ing-stock').value = Number.isSafeInteger(ingredient.stock) ? ingredient.stock : 0;
    document.getElementById('edit-ing-threshold').value = Number.isSafeInteger(ingredient.restockThreshold) ? ingredient.restockThreshold : 0;
    openModal('modal-edit-ingredient');
}

function requestDelete(type, id) {
    const item = type === 'potion' ? state.potions[id] : state.ingredients[id];
    if (!item) return;

    pendingDelete = { type, id };
    document.getElementById('confirm-delete-title').innerText = `Delete ${type}?`;
    document.getElementById('confirm-delete-message').innerText = type === 'ingredient'
        ? `Delete "${item.name}"? It will also be removed from all potion recipes. This cannot be undone.`
        : `Delete "${item.name}"? This cannot be undone.`;
    openModal('modal-confirm-delete');
}

async function confirmDelete() {
    if (!pendingDelete) return;

    const deletion = pendingDelete;
    try {
        if (deletion.type === 'potion') {
            await deletePotion(deletion.id);
            closeModal('modal-edit-potion');
            showToast('Potion deleted.');
        } else {
            await deleteIngredient(deletion.id, state.potions);
            closeModal('modal-edit-ingredient');
            showToast('Ingredient deleted.');
        }
        pendingDelete = null;
        closeModal('modal-confirm-delete');
    } catch (err) {
        showToast(`Could not delete ${deletion.type}: ${err.message}`, 'error');
    }
}

export function renderBatchSelect() {
    const select = document.getElementById('batch-potion-select');
    if (!select) return;

    const placeholder = state.potionsLoadError
        ? 'Could not load potions'
        : state.potionsLoaded ? 'Select Potion...' : 'Loading potions...';
    select.disabled = !state.potionsLoaded || Boolean(state.potionsLoadError);
    select.innerHTML = `<option value="">${placeholder}</option>` +
        sortEntriesByName(Object.entries(state.potions))
            .map(([id, p]) => `<option value="${escapeHTML(id)}">${escapeHTML(p.name)}</option>`)
            .join('');
}

export function renderBatchQueue() {
    const queueDiv = document.getElementById('batch-queue');
    const resultsDiv = document.getElementById('batch-results');
    const brewButton = document.getElementById('btn-brew-batch');
    const batchInputs = [
        document.getElementById('batch-potion-select'),
        document.getElementById('batch-qty'),
        document.getElementById('btn-add-batch')
    ];
    if (!queueDiv || !resultsDiv || !brewButton) return;

    batchInputs.forEach((input) => {
        if (input) input.disabled = isBatchBrewing;
    });

    if (state.batchQueue.length === 0) {
        queueDiv.innerHTML = '';
        resultsDiv.innerText = 'Add potions to calculate ingredient cost, profit, and availability.';
        brewButton.disabled = true;
        return;
    }

    const requiredIngredients = new Map();
    const summaryLines = [];
    let totalCost = 0;
    let totalSale = 0;
    let costKnown = true;
    let saleKnown = true;
    let recipesValid = true;

    queueDiv.innerHTML = state.batchQueue.map((item, index) => {
        const p = state.potions[item.id];
        if (!p) {
            recipesValid = false;
            costKnown = false;
            saleKnown = false;
            summaryLines.push(`• Unknown potion (${item.id})`);
            return '';
        }
        const recipe = Object.entries(p.ingredients || {});
        const lineSale = Number.isFinite(p.salePrice) ? p.salePrice * item.qty : 0;
        if (Number.isFinite(p.salePrice) && Number.isFinite(lineSale)) totalSale += lineSale;
        else saleKnown = false;

        if (!Number.isSafeInteger(item.qty) || item.qty < 1 || recipe.length === 0) {
            recipesValid = false;
            costKnown = false;
            summaryLines.push(`• ${item.qty}x ${p.name}: recipe missing or invalid`);
        } else {
            let lineCost = 0;
            let lineCostKnown = true;
            recipe.forEach(([ingredientId, perPotion]) => {
                if (!Number.isSafeInteger(perPotion) || perPotion < 1) {
                    recipesValid = false;
                    lineCostKnown = false;
                    return;
                }

                const required = perPotion * item.qty;
                const combined = (requiredIngredients.get(ingredientId) || 0) + required;
                if (!Number.isSafeInteger(required) || !Number.isSafeInteger(combined)) {
                    recipesValid = false;
                    lineCostKnown = false;
                    return;
                }
                requiredIngredients.set(ingredientId, combined);

                const ingredient = state.ingredients[ingredientId];
                if (!ingredient) {
                    recipesValid = false;
                    lineCostKnown = false;
                } else if (Number.isFinite(ingredient.price) && ingredient.price >= 0) {
                    const ingredientCost = ingredient.price * required;
                    if (Number.isFinite(ingredientCost) && Number.isFinite(lineCost + ingredientCost)) {
                        lineCost += ingredientCost;
                    } else {
                        lineCostKnown = false;
                    }
                } else {
                    lineCostKnown = false;
                }
            });

            if (lineCostKnown) totalCost += lineCost;
            else costKnown = false;
            const lineProfit = lineCostKnown && Number.isFinite(p.salePrice)
                ? `profit ${formatGold(lineSale - lineCost)}`
                : 'profit unknown';
            summaryLines.push(`• ${item.qty}x ${p.name}: cost ${lineCostKnown ? formatGold(lineCost) : 'unknown'}, sale ${Number.isFinite(p.salePrice) ? formatGold(lineSale) : 'unknown'}, ${lineProfit}`);
        }

        return `
            <span class="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-2.5 py-1 rounded text-xs">
                <span>${item.qty}x ${escapeHTML(p.name)}</span>
                <button type="button" data-action="remove-batch" data-index="${index}" ${isBatchBrewing ? 'disabled' : ''} class="text-zinc-400 hover:text-red-400 disabled:opacity-50">✕</button>
            </span>
        `;
    }).join('');

    const shortages = [];
    for (const [ingredientId, required] of requiredIngredients) {
        const ingredient = state.ingredients[ingredientId];
        if (!ingredient || !Number.isSafeInteger(ingredient.stock) || ingredient.stock < required) {
            shortages.push(`${ingredient?.name || 'Unknown ingredient'} (${ingredient?.stock || 0}/${required})`);
        }
    }

    const availability = !recipesValid
        ? 'Recipe needs attention before brewing.'
        : shortages.length
            ? `Not enough ingredients: ${shortages.join(', ')}`
            : 'All required ingredients are available.';
    const profit = costKnown && saleKnown ? formatGold(totalSale - totalCost) : 'Unknown';
    resultsDiv.innerText = `${summaryLines.join('\n')}\n\nIngredient cost: ${costKnown ? formatGold(totalCost) : 'Unknown'}\nSale value: ${saleKnown ? formatGold(totalSale) : 'Unknown'}\nEstimated profit: ${profit}\n${availability}`;
    brewButton.disabled = isBatchBrewing || !recipesValid || shortages.length > 0;
}

function formatGold(amount) {
    return Number.isFinite(amount) ? `${Number(amount.toFixed(2))}g` : 'Unknown';
}

// ==========================================
// EVENT BINDINGS
// ==========================================
export function initUI() {
    const tabStore = document.getElementById('tab-store');
    const tabCodex = document.getElementById('tab-codex');
    const viewStore = document.getElementById('view-store');
    const viewCodex = document.getElementById('view-codex');
    const storeTabPotions = document.getElementById('store-tab-potions');
    const storeTabIngredients = document.getElementById('store-tab-ingredients');
    const storePanelPotions = document.getElementById('store-panel-potions');
    const storePanelIngredients = document.getElementById('store-panel-ingredients');
    const codexTabIngredients = document.getElementById('codex-tab-ingredients');
    const codexTabPotions = document.getElementById('codex-tab-potions');
    const codexPanelIngredients = document.getElementById('codex-panel-ingredients');
    const codexPanelPotions = document.getElementById('codex-panel-potions');

    tabStore.addEventListener('click', () => activateTab(tabStore, tabCodex, viewStore, viewCodex));
    tabCodex.addEventListener('click', () => activateTab(tabCodex, tabStore, viewCodex, viewStore));
    storeTabPotions.addEventListener('click', () => activatePanelTab(
        storeTabPotions,
        storeTabIngredients,
        storePanelPotions,
        storePanelIngredients
    ));
    storeTabIngredients.addEventListener('click', () => activatePanelTab(
        storeTabIngredients,
        storeTabPotions,
        storePanelIngredients,
        storePanelPotions
    ));
    codexTabIngredients.addEventListener('click', () => activatePanelTab(
        codexTabIngredients,
        codexTabPotions,
        codexPanelIngredients,
        codexPanelPotions
    ));
    codexTabPotions.addEventListener('click', () => activatePanelTab(
        codexTabPotions,
        codexTabIngredients,
        codexPanelPotions,
        codexPanelIngredients
    ));

    // Modal triggers & close buttons
    document.querySelectorAll('.close-modal').forEach((btn) => {
        btn.addEventListener('click', (e) => e.target.closest('dialog')?.close());
    });
    document.getElementById('modal-confirm-delete')?.addEventListener('close', () => {
        pendingDelete = null;
    });

    document.getElementById('price-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="show-ingredient-potions"]');
        if (btn) showIngredientPotions(btn.dataset.id);
    });

    document.getElementById('btn-open-login')?.addEventListener('click', () => openModal('modal-login'));
    document.getElementById('floating-satchel')?.addEventListener('click', () => openModal('modal-satchel'));
    document.getElementById('btn-open-admin-page')?.addEventListener('click', openAdminPage);
    document.getElementById('btn-admin-back')?.addEventListener('click', () => tabStore.click());
    document.getElementById('btn-open-add-potion')?.addEventListener('click', () => openModal('modal-add-potion'));
    document.getElementById('btn-open-add-ingredient')?.addEventListener('click', () => openModal('modal-add-ingredient'));
    document.getElementById('btn-add-recipe-ingredient')?.addEventListener('click', () => addRecipeIngredientRow('recipe-ingredients'));
    document.getElementById('btn-edit-add-recipe-ingredient')?.addEventListener('click', () => addRecipeIngredientRow('edit-pot-recipe-ingredients'));
    document.querySelectorAll('.recipe-ingredients-list').forEach((list) => list.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="remove-recipe-ingredient"]');
        if (btn) btn.closest('[data-recipe-row]')?.remove();
    }));

    document.getElementById('potion-inventory')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="edit-potion"]');
        if (btn) openPotionEditor(btn.dataset.id);
    });

    document.getElementById('ingredient-inventory')?.addEventListener('click', async (e) => {
        const addStockButton = e.target.closest('[data-action="add-ingredient-stock"]');
        if (addStockButton) {
            const input = addStockButton.parentElement.querySelector('input[type="number"]');
            const quantity = Number(input.value);
            if (!Number.isSafeInteger(quantity) || quantity < 1) {
                showToast('Enter a whole quantity of at least 1.', 'error');
                return;
            }

            addStockButton.disabled = true;
            try {
                await increaseIngredientStock(addStockButton.dataset.id, quantity);
                showToast(`Added ${quantity} units to stock.`);
            } catch (err) {
                const message = err.message === 'STOCK_UPDATE_ABORTED'
                    ? 'The stock could not be updated. Check the ingredient and try again.'
                    : err.message;
                showToast(`Could not increase stock: ${message}`, 'error');
            } finally {
                addStockButton.disabled = false;
            }
            return;
        }

        const editButton = e.target.closest('[data-action="edit-ingredient"]');
        if (editButton) openIngredientEditor(editButton.dataset.id);
    });
    document.getElementById('btn-delete-potion')?.addEventListener('click', () => {
        requestDelete('potion', document.getElementById('edit-pot-id').value);
    });
    document.getElementById('btn-delete-ingredient')?.addEventListener('click', () => {
        requestDelete('ingredient', document.getElementById('edit-ing-id').value);
    });
    document.getElementById('btn-cancel-delete')?.addEventListener('click', () => {
        closeModal('modal-confirm-delete');
    });
    document.getElementById('btn-confirm-delete')?.addEventListener('click', confirmDelete);

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

    document.getElementById('codex-category-filters')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.codex-cat-filter');
        if (!btn) return;
        setCodexCategory(btn.dataset.cat);
        renderCodexPotions();
    });

    document.getElementById('catalog-grid')?.addEventListener('click', (e) => {
        const quantityButton = e.target.closest('[data-action="adjust-store-quantity"]');
        if (quantityButton) {
            adjustQuantityInput(quantityButton);
            return;
        }

        const btn = e.target.closest('[data-action="add-satchel"]');
        if (!btn) return;
        const quantity = Number(btn.parentElement.querySelector('input[type="number"]').value);
        if (!Number.isSafeInteger(quantity) || quantity < 1) {
            showToast('Enter a whole quantity of at least 1.', 'error');
            return;
        }
        try {
            addSatchelItem(btn.dataset.id, quantity);
        } catch (err) {
            showToast(`Could not add to satchel: ${err.message}`, 'error');
            return;
        }
        renderSatchel();
        showToast(`Added ${quantity} to satchel.`);
    });

    document.getElementById('satchel-items')?.addEventListener('click', (e) => {
        const quantityButton = e.target.closest('[data-action="adjust-satchel-quantity"]');
        if (quantityButton) {
            const index = Number(quantityButton.dataset.index);
            const item = state.satchel[index];
            const input = quantityButton.parentElement.querySelector('input[type="number"]');
            if (!item || !input) return;

            const inputQuantity = Number(input.value);
            const currentQuantity = Number.isSafeInteger(inputQuantity) && inputQuantity >= 1
                ? inputQuantity
                : item.qty;
            const updatedQuantity = Math.max(1, currentQuantity + Number(quantityButton.dataset.delta));
            if (!Number.isSafeInteger(updatedQuantity)) {
                showToast('Quantity is too large.', 'error');
                return;
            }
            input.value = updatedQuantity;
            updateSatchelQuantityFromInput(input);
            renderSatchel();
            return;
        }

        const btn = e.target.closest('[data-action="remove-satchel"]');
        if (!btn) return;
        removeSatchelItem(Number(btn.dataset.index));
        renderSatchel();
    });

    document.getElementById('satchel-items')?.addEventListener('input', (e) => {
        const input = e.target.closest('[data-action="set-satchel-quantity"]');
        if (input) updateSatchelQuantityFromInput(input);
    });

    document.getElementById('satchel-items')?.addEventListener('change', (e) => {
        const input = e.target.closest('[data-action="set-satchel-quantity"]');
        if (!input || updateSatchelQuantityFromInput(input)) return;

        const item = state.satchel[Number(input.dataset.index)];
        if (item) input.value = item.qty;
        showToast('Enter a whole quantity of at least 1.', 'error');
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
        if (isBatchBrewing) return;
        const potionId = document.getElementById('batch-potion-select')?.value;
        const qty = Number(document.getElementById('batch-qty')?.value);
        if (!potionId || !Number.isSafeInteger(qty) || qty < 1) return;
        addBatchItem(potionId, qty);
        renderBatchQueue();
    });

    document.getElementById('batch-queue')?.addEventListener('click', (e) => {
        if (isBatchBrewing) return;
        const btn = e.target.closest('[data-action="remove-batch"]');
        if (!btn) return;
        removeBatchItem(Number(btn.dataset.index));
        renderBatchQueue();
    });
    document.getElementById('btn-brew-batch')?.addEventListener('click', async (e) => {
        const button = e.currentTarget;
        if (button.disabled || isBatchBrewing) return;
        isBatchBrewing = true;
        const batch = state.batchQueue.map(({ id, qty }) => ({ id, qty }));
        renderBatchQueue();

        try {
            await brewBatch(batch, state.potions);
            clearBatchQueue();
            showToast('Batch brewed; ingredient stock deducted.', 'success');
        } catch (err) {
            showToast(`Could not brew batch: ${err.message}`, 'error');
        } finally {
            isBatchBrewing = false;
            renderBatchQueue();
        }
    });

    // Admin database forms
    document.getElementById('admin-add-potion')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const recipe = collectRecipe('recipe-ingredients');
        if (!recipe) return;

        try {
            await createPotion({
                name: document.getElementById('add-pot-name').value,
                category: document.getElementById('add-pot-cat').value,
                description: document.getElementById('add-pot-description').value,
                salePrice: Number(document.getElementById('add-pot-price').value),
                ingredients: recipe,
                hidden: document.getElementById('add-pot-hidden').checked,
                hideRecipe: document.getElementById('add-pot-hide-recipe').checked,
                hideFromCodex: document.getElementById('add-pot-hide-codex').checked
            });
            showToast('Potion added.', 'success');
            e.target.reset();
            document.getElementById('recipe-ingredients').innerHTML = '';
            closeModal('modal-add-potion');
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
                stock: Number(document.getElementById('add-ing-stock').value),
                restockThreshold: Number(document.getElementById('add-ing-threshold').value)
            });
            showToast('Ingredient added.', 'success');
            e.target.reset();
            closeModal('modal-add-ingredient');
        } catch (err) {
            showToast(`Could not add ingredient: ${err.message}`, 'error');
        }
    });

    document.getElementById('admin-edit-potion')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const recipe = collectRecipe('edit-pot-recipe-ingredients');
        if (!recipe) return;

        try {
            await updatePotion(document.getElementById('edit-pot-id').value, {
                name: document.getElementById('edit-pot-name').value,
                category: document.getElementById('edit-pot-cat').value,
                description: document.getElementById('edit-pot-description').value,
                salePrice: Number(document.getElementById('edit-pot-price').value),
                ingredients: recipe,
                hidden: document.getElementById('edit-pot-hidden').checked,
                hideRecipe: document.getElementById('edit-pot-hide-recipe').checked,
                hideFromCodex: document.getElementById('edit-pot-hide-codex').checked
            });
            showToast('Potion updated.');
            closeModal('modal-edit-potion');
        } catch (err) {
            showToast(`Could not update potion: ${err.message}`, 'error');
        }
    });

    document.getElementById('admin-edit-ingredient')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await updateIngredient(document.getElementById('edit-ing-id').value, {
                name: document.getElementById('edit-ing-name').value,
                price: Number(document.getElementById('edit-ing-price').value),
                stock: Number(document.getElementById('edit-ing-stock').value),
                restockThreshold: Number(document.getElementById('edit-ing-threshold').value)
            });
            showToast('Ingredient updated.');
            closeModal('modal-edit-ingredient');
        } catch (err) {
            showToast(`Could not update ingredient: ${err.message}`, 'error');
        }
    });
}