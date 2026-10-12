//GRABS ELEMENTS AND PLACES IN AN ARRAY
const form = document.getElementById("add-form");
const input = document.getElementById("item-input");
const list = document.getElementById("grocery-list");
const quantityInput = document.getElementById("quantity-input");
const addBtn = document.getElementById("add-btn");
const statusEl = document.getElementById("status");

let items = [];

//PICKS THE API: /demo USES THE PUBLIC SANDBOX, EVERYTHING ELSE USES THE LOGGED-IN API
const isDemo = location.pathname.startsWith("/demo");
const API = isDemo ? "/api/demo/items" : "/api/items";

//ALLOWLIST FOR ITEM NAMES (the server enforces the same rule)
//letters (any language), combining accent marks, numbers, spaces, and: ' ’ & , . - % ( ) /
const ALLOWED_NAME = /^[\p{L}\p{M}\p{N} '’&,.\-%()/]+$/u;
const NAME_ERROR = "Item names can only use letters, numbers, spaces and ' & , . - % ( ) /";

//TALKS TO THE API. RETURNS THE JSON BODY OR THROWS AN ERROR WITH A READABLE MESSAGE
async function api(path = "", options = {}) {
    let res;
    try {
        res = await fetch(API + path, {
            headers: { "Content-Type": "application/json" },
            ...options,
        });
    } catch {
        throw new Error("Can't reach the server. Check your connection and try again.");
    }

    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("You're signed out. Please reload the page to sign in.");
    if (!res.ok) throw new Error(body.error || `Something went wrong (${res.status}).`);
    return body;
}

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

//LOADS THE SAVED LIST FROM THE SERVER
async function loadItems() {
    statusEl.textContent = "Loading your list...";
    try {
        items = await api();
        statusEl.textContent = "";
        render();
    } catch (err) {
        statusEl.textContent = err.message;
    }
}

//ADDS AN ITEM WITH A NAME AND A QUANTITY (SAVED ON THE SERVER)
async function addItem(event) {
    event.preventDefault();               // stop the form reloading the page
    const text = input.value.trim();
    if (text === "") return;

    if (!ALLOWED_NAME.test(text)) {
        statusEl.textContent = NAME_ERROR;
        return;
    }

    const quantity = Number(quantityInput.value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        statusEl.textContent = "Quantity must be a whole number between 1 and 99.";
        return;
    }

    addBtn.disabled = true;               // prevents double submits while saving
    try {
        const saved = await api("", {
            method: "POST",
            body: JSON.stringify({ text, quantity }),
        });
        items.push(saved);                // the server assigns the id
        statusEl.textContent = "";
        render();

        input.value = "";
        quantityInput.value = 1;          // reset to default
    } catch (err) {
        statusEl.textContent = err.message;
    } finally {
        addBtn.disabled = false;
        input.focus();
    }
}

//REMOVE ITEM IF NEEDED (DELETED ON THE SERVER FIRST)
async function removeItem(id) {
    try {
        await api(`/${id}`, { method: "DELETE" });
        items = items.filter((item) => item.id !== id);
        statusEl.textContent = "";
        render();
    } catch (err) {
        statusEl.textContent = err.message;
    }
}

//SUBMIT ITEMS
form.addEventListener("submit", addItem);
loadItems();
