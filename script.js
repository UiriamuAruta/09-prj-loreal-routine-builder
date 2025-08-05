// script.js

// API endpoint (Cloudflare Worker or Pages Function URL)
const API_ENDPOINT = 'https://uiriamuloreal.xieyuuuu.workers.dev/api/routine';

// State
let products = [];
const selected = new Map();
const chatHistory = [];

// Elements
const productsContainer   = document.getElementById('productsContainer');
const categoryFilter      = document.getElementById('categoryFilter');
const productSearch       = document.getElementById('productSearch');
const rtlToggle           = document.getElementById('rtlToggle');
const selectedList        = document.getElementById('selectedProductsList');
const clearBtn            = document.getElementById('clearSelections');
const generateBtn         = document.getElementById('generateRoutine');
const descriptionModal    = document.getElementById('descriptionModal');
const modalName           = document.getElementById('modalProductName');
const modalDesc           = document.getElementById('modalProductDesc');
const closeModalBtn       = document.getElementById('closeModal');
const chatWindow          = document.getElementById('chatWindow');
const chatForm            = document.getElementById('chatForm');
const userInput           = document.getElementById('userInput');
const sendBtn             = document.getElementById('sendBtn');

// Load products from JSON
async function loadProducts() {
  try {
    const res  = await fetch('products.json');
    const data = await res.json();
    products    = data.products || [];
  } catch (err) {
    console.error('Failed to load products:', err);
    chatWindow.innerHTML = `<p style="color:red;">Error loading products: ${err.message}</p>`;
    return;
  }
  restoreSelections();
  renderProducts();
  renderSelected();
}

// Render product grid
function renderProducts() {
  productsContainer.innerHTML = '';
  const category  = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();

  products
    .filter(p => (!category || p.category === category))
    .filter(p => p.name.toLowerCase().includes(searchTerm))
    .forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      if (selected.has(p.id)) card.classList.add('selected');

      card.innerHTML = `
        <img src="${p.image}" alt="${p.name}" />
        <h4>${p.name}</h4>
        <button class="info-btn" title="View description">
          <i class="fa-solid fa-info"></i>
        </button>
      `;
      card.addEventListener('click', e => {
        if (e.target.closest('.info-btn')) return;
        toggleSelect(p.id);
      });
      card.querySelector('.info-btn').addEventListener('click', e => {
        e.stopPropagation();
        openModal(p);
      });
      productsContainer.append(card);
    });
}

// Toggle selection
function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id);
  else {
    const prod = products.find(p => p.id === id);
    if (prod) selected.set(id, prod);
  }
  saveSelections();
  renderProducts();
  renderSelected();
}

// Render selected list
function renderSelected() {
  selectedList.innerHTML = '';
  selected.forEach((p, id) => {
    const item = document.createElement('div');
    item.className = 'selected-item';
    item.innerHTML = `
      <span>${p.name}</span>
      <button title="Remove">
        <i class="fa-solid fa-times"></i>
      </button>
    `;
    item.querySelector('button').addEventListener('click', () => toggleSelect(id));
    selectedList.append(item);
  });
}

// Clear all
clearBtn.addEventListener('click', () => {
  selected.clear();
  saveSelections();
  renderProducts();
  renderSelected();
});

// Persistence
function saveSelections() {
  localStorage.setItem('lorealSelected', JSON.stringify([...selected.keys()]));
}
function restoreSelections() {
  const saved = JSON.parse(localStorage.getItem('lorealSelected') || '[]');
  saved.forEach(id => {
    const prod = products.find(p => p.id === id);
    if (prod) selected.set(id, prod);
  });
}

// Filters
categoryFilter.addEventListener('change', renderProducts);
productSearch.addEventListener('input', renderProducts);

// RTL toggle
rtlToggle.addEventListener('click', () => {
  const isRtl = rtlToggle.getAttribute('aria-pressed') === 'true';
  document.documentElement.setAttribute('dir', isRtl ? 'ltr' : 'rtl');
  rtlToggle.setAttribute('aria-pressed', String(!isRtl));
});

// Modal
function openModal(p) {
  modalName.textContent = p.name;
  modalDesc.textContent = p.description;
  descriptionModal.classList.remove('hidden');
}
closeModalBtn.addEventListener('click', () => {
  descriptionModal.classList.add('hidden');
});

// Generate routine
generateBtn.addEventListener('click', async () => {
  if (!selected.size) { alert('Please select at least one product.'); return; }
  generateBtn.disabled = true;
  chatWindow.innerHTML = '<p>Generating your routine…</p>';
  try {
    const payload = { products: [...selected.values()].map(p => ({ name: p.name, brand: p.brand, category: p.category, description: p.description })) };
    const res = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    chatWindow.innerHTML = `<p>${data.routine}</p>`;
    chatHistory.push({ role: 'assistant', content: data.routine });
    userInput.disabled = false; sendBtn.disabled = false;
  } catch (err) {
    console.error(err);
    chatWindow.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  } finally {
    generateBtn.disabled = false;
  }
});

// Chat follow-up
chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  const question = userInput.value.trim(); if (!question) return;
  chatWindow.innerHTML += `<p><strong>You:</strong> ${question}</p>`;
  chatHistory.push({ role: 'user', content: question }); userInput.value = '';
  try {
    const res = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: chatHistory }) });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    chatWindow.innerHTML += `<p><strong>Bot:</strong> ${data.reply}</p>`;
    chatHistory.push({ role: 'assistant', content: data.reply });
    chatWindow.scrollTop = chatWindow.scrollHeight;
  } catch (err) {
    console.error(err);
    chatWindow.innerHTML += `<p style="color:red;">Error: ${err.message}</p>`;
  }
});

// Initialize
loadProducts();
