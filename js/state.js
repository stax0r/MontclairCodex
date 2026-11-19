export const state = {
    potions: {},
    ingredients: {},
    potionsLoaded: false,
    ingredientsLoaded: false,
    potionsLoadError: '',
    ingredientsLoadError: '',
    locations: {},
    prices: {},
    satchel: [],
    batchQueue: [],
    selectedCategory: 'All',
    selectedCodexCategory: 'All',
    searchQuery: ''
};

export function setPotions(potions) {
    state.potions = potions || {};
    state.potionsLoaded = true;
    state.potionsLoadError = '';
}

export function setPotionsLoadError(error) {
    state.potionsLoaded = true;
    state.potionsLoadError = error;
}

export function setIngredients(ingredients) {
    state.ingredients = ingredients || {};
    state.ingredientsLoaded = true;
    state.ingredientsLoadError = '';
}

export function setIngredientsLoadError(error) {
    state.ingredientsLoaded = true;
    state.ingredientsLoadError = error;
}

export function setCategory(category) {
    state.selectedCategory = category;
}

export function setCodexCategory(category) {
    state.selectedCodexCategory = category;
}

export function setSearchQuery(query) {
    state.searchQuery = query.toLowerCase().trim();
}

export function addSatchelItem(potionId, quantity = 1) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new Error('INVALID_SATCHEL_QUANTITY');
    }

    const existing = state.satchel.find((item) => item.id === potionId);
    if (existing) {
        const updatedQuantity = existing.qty + quantity;
        if (!Number.isSafeInteger(updatedQuantity)) {
            throw new Error('INVALID_SATCHEL_QUANTITY');
        }
        existing.qty = updatedQuantity;
    } else {
        state.satchel.push({ id: potionId, qty: quantity });
    }
}

export function removeSatchelItem(index) {
    state.satchel.splice(index, 1);
}

export function setSatchelItemQuantity(index, quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new Error('INVALID_SATCHEL_QUANTITY');
    }

    const item = state.satchel[index];
    if (!item) {
        throw new Error('SATCHEL_ITEM_NOT_FOUND');
    }
    item.qty = quantity;
}

export function clearSatchel() {
    state.satchel = [];
}

export function addBatchItem(potionId, qty) {
    const existing = state.batchQueue.find((item) => item.id === potionId);
    if (existing) {
        existing.qty += qty;
    } else {
        state.batchQueue.push({ id: potionId, qty });
    }
}

export function removeBatchItem(index) {
    state.batchQueue.splice(index, 1);
}

export function clearBatchQueue() {
    state.batchQueue = [];
}