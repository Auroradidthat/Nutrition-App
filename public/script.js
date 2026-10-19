import { MAX_NAME_LENGTH, MIN_QUANTITY, MAX_QUANTITY, validateItem } from "/rules.js";

//GRABS ELEMENTS
const form = document.getElementById("add-form");
const input = document.getElementById("item-input");
const list = document.getElementById("item-list");
const quantityInput = document.getElementById("quantity-input");
const addBtn = document.getElementById("add-btn");
const statusEl = document.getElementById("status");

//INPUT LIMITS COME FROM THE SHARED RULES, SO THE HTML NEVER DRIFTS FROM THE SERVER
input.maxLength = MAX_NAME_LENGTH;
quantityInput.min = MIN_QUANTITY;
quantityInput.max = MAX_QUANTITY;

let items = [];

const API = "/api/items";

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

function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
}

//RUNS AN ACTION, CLEARS THE STATUS ON SUCCESS AND SHOWS THE ERROR ON FAILURE
async function run(action) {
    try {
        await action();
        setStatus("");
    } catch (err) {
        setStatus(err.message, true);
    }
}

//BUILDS ONE ROW CONTAINING TEXT, QUANTITY AND A REMOVE BUTTON
function createRow(item) {
    const li = document.createElement("li");

    const text = document.createElement("span");
    text.textContent = item.text;

    const qty = document.createElement("span");
    qty.className = "item-qty";
    qty.textContent = `×${item.quantity}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.dataset.id = item.id;

    li.append(text, qty, removeBtn);
    return li;
}

function render() {
    list.replaceChildren(...items.map(createRow));
}

//LOADS THE SAVED LIST FROM THE SERVER
async function loadItems() {
    setStatus("Loading your list...");
    await run(async () => {
        items = await api();
        render();
    });
}

//ADDS AN ITEM WITH A NAME AND A QUANTITY (SAVED ON THE SERVER)
async function addItem(event) {
    event.preventDefault();               // stop the form reloading the page
    const text = input.value.trim();
    if (text === "") return;

    const quantity = Number(quantityInput.value);
    const error = validateItem(text, quantity);
    if (error) {
        setStatus(error, true);
        return;
    }

    addBtn.disabled = true;               // prevents double submits while saving
    await run(async () => {
        const saved = await api("", { method: "POST", body: JSON.stringify({ text, quantity }) });
        items.push(saved);                // the server assigns the id
        render();
        input.value = "";
        quantityInput.value = MIN_QUANTITY;
    });
    addBtn.disabled = false;
    input.focus();
}

//REMOVES AN ITEM (DELETED ON THE SERVER FIRST)
function removeItem(id) {
    return run(async () => {
        await api(`/${id}`, { method: "DELETE" });
        items = items.filter((item) => item.id !== id);
        render();
    });
}

//ONE CLICK LISTENER FOR EVERY REMOVE BUTTON
list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-id]");
    if (button) removeItem(Number(button.dataset.id));
});

form.addEventListener("submit", addItem);
loadItems();
