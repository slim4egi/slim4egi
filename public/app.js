let products = [];

const state = {
  search: '',
  brand: 'all',
  topCategory: 'all',
  subCategory: 'all',
  sort: 'featured',
  visibleLimit: 48
};

const topCategoryOrder = [
  'Приборы учета',
  'Узлы коллекторные',
  'Арматура трубопроводная',
  'Системы учета энергоресурсов и компоненты АСКУЭ'
];

const topCategoryLabels = {
  'Приборы учета': 'Приборы учета',
  'Узлы коллекторные': 'Узлы коллекторные',
  'Арматура трубопроводная': 'Арматура трубопроводная',
  'Системы учета энергоресурсов и компоненты АСКУЭ': 'Системы учета энергоресурсов и компоненты АСКУЭ'
};

const grid = document.querySelector('#product-grid');
const count = document.querySelector('#results-count');
const empty = document.querySelector('#empty-state');
const search = document.querySelector('#search');
const brandFilter = document.querySelector('#brand-filter');
const sortFilter = document.querySelector('#sort-filter');
const topChipContainer = document.querySelector('#top-category-filters');
const subChipContainer = document.querySelector('#subcategory-filters');
const resetButton = document.querySelector('#reset-filters');
const loadMoreButton = document.querySelector('#load-more');
const introCount = document.querySelector('#intro-count');
const cartButton = document.querySelector('#cart-button');
const cartCount = document.querySelector('#cart-count');
const cartModal = document.querySelector('#cart-modal');
const cartContent = document.querySelector('#cart-content');
const requestModal = document.querySelector('#request-modal');
const requestForm = document.querySelector('#request-form');
let requestSummary = document.querySelector('#request-summary');

const CART_KEY = 'stk_meter_cart_v1';
let cart = loadCart();

const rubles = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch { return {}; }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function cartTotalUnits() {
  return Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartCount() {
  cartCount.textContent = String(cartTotalUnits());
  cartButton.setAttribute('aria-label', `Открыть заявку, товаров: ${cartTotalUnits()}`);
}

function addToCart(productId) {
  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) return;
  const key = String(product.id);
  if (!cart[key]) {
    cart[key] = { id: product.id, quantity: 1 };
  } else {
    cart[key].quantity += 1;
  }
  saveCart();
  render();
  openCart();
}

function changeQuantity(productId, delta) {
  const key = String(productId);
  if (!cart[key]) return;
  cart[key].quantity = Math.max(1, cart[key].quantity + delta);
  saveCart();
  renderCart();
}

function setQuantity(productId, value) {
  const key = String(productId);
  if (!cart[key]) return;
  const quantity = Math.max(1, Math.min(999999, Number.parseInt(value, 10) || 1));
  cart[key].quantity = quantity;
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  delete cart[String(productId)];
  saveCart();
  renderCart();
  render();
}

function clearCart() {
  cart = {};
  saveCart();
  renderCart();
  render();
}

function cartItems() {
  return Object.values(cart).map((item) => {
    const product = products.find((p) => String(p.id) === String(item.id));
    return product ? { product, quantity: item.quantity } : null;
  }).filter(Boolean);
}

function openModal(modal) {
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}
function closeModal(modal) {
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  if (cartModal.hidden && requestModal.hidden) document.body.classList.remove('modal-open');
}
function openCart() { renderCart(); openModal(cartModal); }
function openRequest() {
  const items = cartItems();
  if (!items.length) return openCart();
  renderRequestSummary();
  openModal(requestModal);
}

function renderCart() {
  const items = cartItems();
  if (!items.length) {
    cartContent.innerHTML = `<div class="empty-state"><h3>Заявка пока пуста</h3><p>Добавьте нужные товары в заявку прямо из каталога.</p><button class="button button-primary" type="button" data-close-cart>Вернуться к каталогу</button></div>`;
    return;
  }
  cartContent.innerHTML = `<div class="cart-list">${items.map(({product, quantity}) => {
    const image = product.image || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    return `<article class="cart-item">
      <img class="cart-item-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" onerror="this.style.visibility='hidden'">
      <div><h3>${escapeHtml(product.name)}</h3><p class="cart-item-meta">${escapeHtml(product.brand)}${product.article ? ` · ${escapeHtml(product.article)}` : ''}</p>
      <div class="qty-control"><button type="button" data-cart-minus="${escapeHtml(product.id)}" aria-label="Уменьшить">−</button><input type="number" min="1" max="999999" value="${quantity}" data-cart-qty="${escapeHtml(product.id)}" aria-label="Количество"><button type="button" data-cart-plus="${escapeHtml(product.id)}" aria-label="Увеличить">+</button></div></div>
      <div class="cart-item-side"><strong>${product.price ? `${rubles.format(product.price)} ₽` : 'по запросу'}</strong><br><button class="cart-remove" type="button" data-cart-remove="${escapeHtml(product.id)}">Удалить</button></div>
    </article>`;
  }).join('')}</div><div class="cart-actions"><button class="button button-secondary" type="button" data-clear-cart>Очистить заявку</button><button class="button button-primary" type="button" data-open-request>Оформить заявку</button></div>`;
}

function renderRequestSummary() {
  const items = cartItems();
  requestSummary.innerHTML = `<strong>В заявке ${items.length} ${items.length === 1 ? 'позиция' : 'позиций'} / ${cartTotalUnits()} шт.</strong><br>${items.map(({product, quantity}) => `${escapeHtml(product.name)} — ${quantity} шт.`).join('<br>')}`;
}

function normalizeProduct(product, index) {
  const minOrder = String(product.minOrder || '').replace(/^Продажа:\s*/i, '').trim();
  const price = Number(product.price);
  return {
    id: product.id ?? index + 1,
    brand: product.manufacturer || product.source || 'Поставщик',
    manufacturer: product.manufacturer || product.source || 'Поставщик',
    topCategory: product.topCategory || 'Приборы учета',
    subCategory: product.subCategory || product.category || 'Другое оборудование',
    legacyCategory: product.category || '',
    name: product.name || 'Без наименования',
    article: product.article && product.article !== 'n/n' ? product.article : '',
    price: Number.isFinite(price) && price > 0 ? price : null,
    priceType: product.priceType || (Number.isFinite(price) && price > 0 ? 'до' : 'по запросу'),
    image: product.image || '',
    sourceUrl: product.url || '',
    minOrder,
    availability: product.availability || 'уточняется',
    description: product.description || '',
    specifications: product.specifications || {},
    documents: product.documents || [],
    images: product.images || (product.image ? [product.image] : []),
    index
  };
}

function buildBrandOptions() {
  const brands = [...new Set(products.map((product) => product.brand))].sort((a, b) => a.localeCompare(b, 'ru'));
  brandFilter.innerHTML = '<option value="all">Все бренды</option>' + brands
    .map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`)
    .join('');
}

function buildChips() {
  const topPresent = new Set(products.map((product) => product.topCategory));
  const topGroups = topCategoryOrder;
  topChipContainer.innerHTML = ['all', ...topGroups].map((group) => {
    const label = group === 'all' ? 'Все разделы' : topCategoryLabels[group];
    const disabled = group !== 'all' && !topPresent.has(group) ? ' disabled' : '';
    return `<button class="filter-chip${group === state.topCategory ? ' active' : ''}${disabled}" data-top-category="${escapeHtml(group)}" type="button"${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`;
  }).join('');
  buildSubcategoryChips();
}

function buildSubcategoryChips() {
  const source = state.topCategory === 'all'
    ? products
    : products.filter((product) => product.topCategory === state.topCategory);
  const subs = [...new Set(source.map((product) => product.subCategory))].sort((a,b) => a.localeCompare(b,'ru'));
  subChipContainer.innerHTML = ['all', ...subs].map((sub) => {
    const label = sub === 'all' ? 'Все подкатегории' : sub;
    return `<button class="filter-chip${sub === state.subCategory ? ' active' : ''}" data-subcategory="${escapeHtml(sub)}" type="button">${escapeHtml(label)}</button>`;
  }).join('');
  subChipContainer.hidden = subs.length === 0;
}

function filteredProducts() {
  const needle = state.search.trim().toLocaleLowerCase('ru');
  const filtered = products.filter((product) => {
    const haystack = `${product.name} ${product.article} ${product.legacyCategory} ${product.subCategory} ${product.topCategory} ${product.brand}`.toLocaleLowerCase('ru');
    return (!needle || haystack.includes(needle)) &&
      (state.brand === 'all' || product.brand === state.brand) &&
      (state.topCategory === 'all' || product.topCategory === state.topCategory) &&
      (state.subCategory === 'all' || product.subCategory === state.subCategory);
  });

  if (state.sort === 'price-asc') return filtered.sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
  if (state.sort === 'price-desc') return filtered.sort((a, b) => (b.price ?? Number.NEGATIVE_INFINITY) - (a.price ?? Number.NEGATIVE_INFINITY));
  if (state.sort === 'name') return filtered.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return filtered.sort((a, b) => a.index - b.index);
}

function priceTemplate(product) {
  if (!product.price) {
    return '<div class="product-price price-on-request"><span class="price-label">Цена</span><strong class="price-value">по запросу</strong></div>';
  }
  return `<div class="product-price"><span class="price-label">Цена до</span><strong class="price-value">${rubles.format(product.price)} ₽</strong></div>`;
}

function cardTemplate(product) {
  const imageClass = product.image ? 'product-image' : 'product-image fallback';
  const imageSource = product.image || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  const article = product.article ? `Артикул: ${escapeHtml(product.article)}` : 'Артикул уточняется';
  const delivery = product.minOrder ? `Поставка: ${escapeHtml(product.minOrder)}` : 'Условия — по запросу';
  return `<article class="product-card">
    <div class="product-image-wrap">
      <span class="brand-badge">${escapeHtml(product.brand)}</span>
      <img class="${imageClass}" src="${escapeHtml(imageSource)}" alt="${escapeHtml(product.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.classList.add('fallback')">
      <span class="image-fallback" aria-hidden="true">СТК<br>МЕТЕР</span>
    </div>
    <div class="product-body">
      <p class="product-category">${escapeHtml(product.topCategory)} · ${escapeHtml(product.subCategory)}</p>
      <h3>${escapeHtml(product.name)}</h3>
      <p class="product-article">${article}</p>
      ${priceTemplate(product)}
      <div class="product-footer"><span class="product-min">${delivery}</span><button class="request-product" type="button" data-add-cart="${escapeHtml(product.id)}" aria-label="Добавить ${escapeHtml(product.name)} в заявку">В заявку</button></div>
    </div>
  </article>`;
}

function render() {
  const filtered = filteredProducts();
  const items = filtered.slice(0, state.visibleLimit);
  grid.innerHTML = items.map(cardTemplate).join('');
  count.textContent = `Показано ${items.length} из ${filtered.length} найденных позиций · всего ${products.length}`;
  empty.hidden = filtered.length !== 0;
  grid.hidden = filtered.length === 0;
  loadMoreButton.hidden = items.length >= filtered.length || filtered.length === 0;
  if (!loadMoreButton.hidden) loadMoreButton.textContent = `Показать ещё ${Math.min(48, filtered.length - items.length)}`;
  topChipContainer.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.topCategory === state.topCategory);
  });
  subChipContainer.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.subcategory === state.subCategory);
  });
}

function resetVisibleAndRender() {
  state.visibleLimit = 48;
  render();
}

function resetFilters() {
  state.search = '';
  state.brand = 'all';
  state.topCategory = 'all';
  state.subCategory = 'all';
  state.sort = 'featured';
  state.visibleLimit = 48;
  search.value = '';
  brandFilter.value = 'all';
  sortFilter.value = 'featured';
  render();
}

search.addEventListener('input', () => {
  state.search = search.value;
  resetVisibleAndRender();
});
brandFilter.addEventListener('change', () => {
  state.brand = brandFilter.value;
  resetVisibleAndRender();
});
sortFilter.addEventListener('change', () => {
  state.sort = sortFilter.value;
  resetVisibleAndRender();
});
topChipContainer.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-top-category]');
  if (!chip || chip.disabled) return;
  state.topCategory = chip.dataset.topCategory;
  state.subCategory = 'all';
  buildSubcategoryChips();
  resetVisibleAndRender();
});
subChipContainer.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-subcategory]');
  if (!chip) return;
  state.subCategory = chip.dataset.subcategory;
  resetVisibleAndRender();
});
resetButton.addEventListener('click', resetFilters);
loadMoreButton.addEventListener('click', () => {
  state.visibleLimit += 48;
  render();
});

grid.addEventListener('click', (event) => {
  const add = event.target.closest('[data-add-cart]');
  if (add) addToCart(add.dataset.addCart);
});

cartButton.addEventListener('click', openCart);
cartModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-cart]')) closeModal(cartModal);
  if (event.target.closest('[data-open-request]')) { closeModal(cartModal); openRequest(); }
  if (event.target.closest('[data-clear-cart]')) clearCart();
  const minus = event.target.closest('[data-cart-minus]');
  if (minus) changeQuantity(minus.dataset.cartMinus, -1);
  const plus = event.target.closest('[data-cart-plus]');
  if (plus) changeQuantity(plus.dataset.cartPlus, 1);
  const remove = event.target.closest('[data-cart-remove]');
  if (remove) removeFromCart(remove.dataset.cartRemove);
});
cartModal.addEventListener('change', (event) => {
  const input = event.target.closest('[data-cart-qty]');
  if (input) setQuantity(input.dataset.cartQty, input.value);
});
requestModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-request]')) closeModal(requestModal);
});
requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(requestForm);
  const items = cartItems();
  const consent = data.get('personalDataConsent') === 'on';
  if (!consent || !items.length) return;

  const submitButton = requestForm.querySelector('.submit-request');
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Отправляем…'; }

  const payload = {
    organization: data.get('organization'),
    inn: data.get('inn'),
    kpp: data.get('kpp'),
    contactName: data.get('contact'),
    phone: data.get('phone'),
    email: data.get('email'),
    comment: data.get('comment'),
    consentGiven: consent,
    consentVersion: '2026-09-27-v1',
    items: items.map(({ product, quantity }) => ({
      productId: String(product.id),
      productName: product.name,
      article: product.article || '',
      manufacturer: product.manufacturer || product.brand || '',
      quantity,
      price: product.price
    }))
  };

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Не удалось отправить заявку.');

    requestForm.innerHTML = `<div class="empty-state"><h3>Заявка ${escapeHtml(result.orderNumber)}</h3><p>Заявка успешно принята. В ней ${items.length} ${items.length === 1 ? 'позиция' : 'позиций'} / ${cartTotalUnits()} шт.</p><p>Мы свяжемся с вами для подтверждения цены, наличия и условий поставки.</p><button class="button button-primary" type="button" data-finish-request>Вернуться к каталогу</button></div>`;
  } catch (error) {
    console.error(error);
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Отправить заявку'; }
    alert(error.message || 'Не удалось отправить заявку.');
  }
});
requestModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-finish-request]')) {
    clearCart();
    closeModal(requestModal);
    location.hash = '#catalog';
    requestForm.reset();
    requestForm.innerHTML = `<div class="form-grid"><label>Организация *<input name="organization" required maxlength="200"></label><label>ИНН *<input name="inn" required inputmode="numeric" pattern="[0-9]{10,12}" maxlength="12"></label><label>КПП<input name="kpp" inputmode="numeric" pattern="[0-9]{9}" maxlength="9"></label><label>Контактное лицо *<input name="contact" required maxlength="150"></label><label>Телефон *<input name="phone" required type="tel" maxlength="30"></label><label>E-mail *<input name="email" required type="email" maxlength="200"></label></div><label>Комментарий<textarea name="comment" rows="4" maxlength="2000" placeholder="Пожелания по поставке, срокам, доставке и т. п."></textarea><div class="consent-box"><label class="consent-label"><input id="personal-data-consent" name="personalDataConsent" type="checkbox" required><span>Я даю согласие ООО «СТК Метер» на обработку моих персональных данных в соответствии с <a href="privacy-consent.html" target="_blank" rel="noopener">Согласием на обработку персональных данных</a>.</span></label><p>Согласие является отдельным от заявки и необходимо для её отправки.</p></div><div id="request-summary" class="request-summary"></div><button class="button button-primary submit-request" type="submit">Отправить заявку</button>`;
    requestSummary = document.querySelector('#request-summary');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeModal(cartModal); closeModal(requestModal); }
});

updateCartCount();

async function initializeCatalog() {
  grid.innerHTML = '<p class="catalog-loading">Загружаем полный каталог…</p>';
  const response = await fetch('./products.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Не удалось загрузить каталог: ${response.status}`);
  const rawProducts = await response.json();
  products = rawProducts.map(normalizeProduct);
  introCount.textContent = rubles.format(products.length);
  buildBrandOptions();
  buildChips();
  render();
}

initializeCatalog().catch((error) => {
  console.error(error);
  count.textContent = '';
  grid.innerHTML = '<div class="empty-state"><h3>Каталог временно не загрузился</h3><p>Обновите страницу или отправьте нам перечень — подберём оборудование вручную.</p></div>';
});
