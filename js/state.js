export const state = {
    potions: {},
    ingredients: {},
    locations: {},
    prices: {},
    satchel: [],
    batchQueue: [],
    selectedCategory: 'All',
    searchQuery: ''
};

export function setPotions(potions) {
    state.potions = potions || {};
}

export function setIngredients(ingredients) {
    state.ingredients = ingredients || {};
}

export function setCategory(category) {
    state.selectedCategory = category;
}

export function setSearchQuery(query) {
    state.searchQuery = query.toLowerCase().trim();
}

export function addSatchelItem(potionId) {
    const existing = state.satchel.find((item) => item.id === potionId);
    if (existing) {
        existing.qty++;
    } else {
        state.satchel.push({ id: potionId, qty: 1 });
    }
}

export function removeSatchelItem(index) {
    state.satchel.splice(index, 1);
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