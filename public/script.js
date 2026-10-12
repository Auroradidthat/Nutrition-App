//GRABS ELEMENTS AND PLACES IN AN ARRAY
const form = document.getElementById("add-form");
const input = document.getElementById("item-input");
const list = document.getElementById("grocery-list");
const quantityInput = document.getElementById("quantity-input");
const statusEl = document.getElementById("status");

let items = [];

//ALLOWLIST FOR ITEM NAMES
//letters (any language), combining accent marks, numbers, spaces, and: ' ’ & , . - % ( ) /
const ALLOWED_NAME = /^[\p{L}\p{M}\p{N} '’&,.\-%()/]+$/u;
const NAME_ERROR = "Item names can only use letters, numbers, spaces and ' & , . - % ( ) /";

//BUILDS A ROW CONTAINING TEXT, QUANTITY AND A REMOVE BUTTON
function render() {
    list.replaceChildren();

    items.forEach((item) => {
        const li = document.createElement("li");

        const text = document.createElement("span");
        text.textContent = item.text;

        //ADDS QUANTITY NUMBER TO EACH LINE
        const qty = document.createElement("span");
        qty.className = "item-qty";
        qty.textContent = `×${item.quantity}`;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => removeItem(item.id));

        li.append(text, qty, removeBtn);
        list.appendChild(li);
    });
}

//GIVES EACH ITEM AN ID
let nextId = 1;

//ADDS AN ITEM WITH A NAME AND A QUANTITY
function addItem(event) {
    event.preventDefault();               // stop the form reloading the page
    const text = input.value.trim();
    if (text === "") return;

    if (!ALLOWED_NAME.test(text)) {
        statusEl.textContent = NAME_ERROR;
        return;
    }

    const quantity = Math.floor(Number(quantityInput.value));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
        statusEl.textContent = "Quantity must be between 1 and 99.";
        return;
    }

    items.push({ id: nextId++, text, quantity });
    statusEl.textContent = "";
    render();

    input.value = "";
    quantityInput.value = 1;              // reset to default
    input.focus();
}

//REMOVE ITEM IF NEEDED
function removeItem(id) {
    items = items.filter((item) => item.id !== id);
    render();
}

//SUBMIT ITEMS
form.addEventListener("submit", addItem);
render();
