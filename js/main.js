import { setPotions, setIngredients } from "./state.js";
import { subscribeAuth, subscribePotions, subscribeIngredients } from "./services.js";
import {
    initUI,
    updateAuthUI,
    renderStore,
    renderSatchel,
    renderPriceList,
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
        renderInventory();
        renderSatchel();
        renderBatchSelect();
        renderBatchQueue();
    });

    subscribeIngredients((ingredients) => {
        setIngredients(ingredients);
        renderPriceList();
        renderInventory();
        renderRecipeIngredients();
        renderBatchQueue();
    });
}

bootstrap();