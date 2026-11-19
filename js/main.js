import {
    setPotions,
    setIngredients,
    setPotionsLoadError,
    setIngredientsLoadError
} from "./state.js";
import { subscribeAuth, subscribePotions, subscribeIngredients } from "./services.js";
import {
    initUI,
    updateAuthUI,
    renderStore,
    renderSatchel,
    renderPriceList,
    renderStoreIngredients,
    renderCodexPotions,
    renderInventory,
    renderRecipeIngredients,
    renderBatchSelect,
    renderBatchQueue
} from "./ui.js";

function bootstrap() {
    initUI();

    subscribeAuth((user) => {
        updateAuthUI(user);
    });

    subscribePotions((potions) => {
        setPotions(potions);
        renderStore();
        renderCodexPotions();
        renderInventory();
        renderSatchel();
        renderBatchSelect();
        renderBatchQueue();
    }, (error) => {
        setPotionsLoadError(String(error?.message || error));
        renderStore();
        renderCodexPotions();
        renderInventory();
        renderBatchSelect();
        renderBatchQueue();
    });

    subscribeIngredients((ingredients) => {
        setIngredients(ingredients);
        renderPriceList();
        renderStoreIngredients();
        renderCodexPotions();
        renderInventory();
        renderRecipeIngredients();
        renderBatchQueue();
    }, (error) => {
        setIngredientsLoadError(String(error?.message || error));
        renderPriceList();
        renderStoreIngredients();
        renderCodexPotions();
        renderInventory();
        renderRecipeIngredients();
        renderBatchQueue();
    });
}

bootstrap();