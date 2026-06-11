(function () {
  var LABELS = {
    en: { title: 'Your order',  total: 'Total', items: 'items', cta: 'View order',        clear: 'Clear' },
    ka: { title: 'შეკვეთა',    total: 'სულ',   items: 'პოზ.',  cta: 'შეკვეთის ნახვა',   clear: 'გასუფთავება' },
    ru: { title: 'Ваш заказ',  total: 'Итого', items: 'поз.',  cta: 'Показать заказ',    clear: 'Очистить' },
  };

  var m = window.location.pathname.match(/^\/(en|ka|ru)/);
  var L = LABELS[m ? m[1] : 'en'];

  var cart = {};

  var bar   = document.getElementById('order-bar');
  var popup = document.getElementById('order-popup');
  if (!bar || !popup) return;

  popup.querySelector('.order-popup-title').textContent = L.title;
  popup.querySelector('.order-popup-clear').textContent = L.clear;
  bar.querySelector('.order-bar-cta').textContent       = L.cta;

  function fmt(n) {
    var s = n.toFixed(2);
    return s.endsWith('.00') ? s.slice(0, -3) : s;
  }
  function getTotal() {
    return Object.values(cart).reduce(function (s, v) { return s + v.price * v.qty; }, 0);
  }
  function getCount() {
    return Object.values(cart).reduce(function (s, v) { return s + v.qty; }, 0);
  }
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function updateBar() {
    var count = getCount();
    if (count === 0) {
      bar.classList.add('hidden');
      document.body.classList.remove('has-order-bar');
    } else {
      bar.classList.remove('hidden');
      document.body.classList.add('has-order-bar');
      bar.querySelector('.order-bar-count').textContent = count + ' ' + L.items;
      bar.querySelector('.order-bar-total').textContent = fmt(getTotal()) + ' ₾';
    }
  }

  function updateCardQty(id) {
    var qty = cart[id] ? cart[id].qty : 0;
    document.querySelectorAll('.menu-item[data-id="' + id + '"] .item-qty').forEach(function (row) {
      row.querySelector('.qty-val').textContent = qty;
      row.classList.toggle('active', qty > 0);
    });
  }

  function setQty(id, name, price, qty) {
    if (qty <= 0) { delete cart[id]; }
    else          { cart[id] = { name: name, price: price, qty: qty }; }
    updateCardQty(id);
    updateBar();
  }

  // Wire up menu card +/- buttons
  document.querySelectorAll('.menu-item').forEach(function (card) {
    var id    = card.dataset.id;
    var name  = card.dataset.name;
    var price = parseFloat(card.dataset.price) || 0;

    card.querySelector('.qty-inc').addEventListener('click', function (e) {
      e.stopPropagation();
      setQty(id, name, price, (cart[id] ? cart[id].qty : 0) + 1);
    });
    card.querySelector('.qty-dec').addEventListener('click', function (e) {
      e.stopPropagation();
      var qty = cart[id] ? cart[id].qty : 0;
      if (qty > 0) setQty(id, name, price, qty - 1);
    });
  });

  // Render popup rows with interactive +/- controls
  function renderPopupItems() {
    var ids = Object.keys(cart).filter(function (id) { return cart[id].qty > 0; });
    if (ids.length === 0) { closePopup(); return; }

    var itemsEl = popup.querySelector('.order-popup-items');
    itemsEl.innerHTML = '';

    ids.forEach(function (id) {
      var v   = cart[id];
      var row = document.createElement('div');
      row.className = 'popup-item-row';
      row.innerHTML =
        '<div class="popup-item-qty-ctrl">' +
          '<button class="popup-qty-btn popup-qty-dec" type="button">−</button>' +
          '<span class="popup-qty-val">' + v.qty + '</span>' +
          '<button class="popup-qty-btn popup-qty-inc" type="button">+</button>' +
        '</div>' +
        '<span class="popup-item-name">' + escHtml(v.name) + '</span>' +
        '<span class="popup-item-price">' + fmt(v.price * v.qty) + ' ₾</span>';

      row.querySelector('.popup-qty-inc').addEventListener('click', function () {
        setQty(id, v.name, v.price, (cart[id] ? cart[id].qty : 0) + 1);
        renderPopupItems();
      });
      row.querySelector('.popup-qty-dec').addEventListener('click', function () {
        var qty = cart[id] ? cart[id].qty : 0;
        setQty(id, v.name, v.price, qty - 1);
        if (getCount() === 0) { closePopup(); } else { renderPopupItems(); }
      });

      itemsEl.appendChild(row);
    });

    popup.querySelector('.order-popup-sum').textContent = L.total + ': ' + fmt(getTotal()) + ' ₾';
  }

  function openPopup() {
    if (getCount() === 0) return;
    renderPopupItems();
    popup.classList.remove('hidden');
    document.body.classList.add('popup-open');
  }

  function closePopup() {
    popup.classList.add('hidden');
    document.body.classList.remove('popup-open');
  }

  bar.addEventListener('click', openPopup);
  popup.querySelector('.order-popup-close').addEventListener('click', closePopup);
  popup.querySelector('.order-popup-overlay').addEventListener('click', closePopup);
  popup.querySelector('.order-popup-clear').addEventListener('click', function () {
    cart = {};
    document.querySelectorAll('.menu-item .item-qty').forEach(function (row) {
      row.querySelector('.qty-val').textContent = '0';
      row.classList.remove('active');
    });
    updateBar();
    closePopup();
  });
})();
