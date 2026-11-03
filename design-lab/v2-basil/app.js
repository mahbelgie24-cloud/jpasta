const dishes = {
  "fettuccine-mushroom": {
    name: "فيتوتشيني مع فطر",
    desc: "فيتوتشيني باستا مع فطر طازج، جبنة بارميزان، وريحان، بصلصة ألفريدو كريمية تُحضّر كل صباح.",
    price: 20,
    tag: "طبق التوقيع",
    image: "../assets/img/fettuccine-mushroom-900.webp",
  },
  "penne-pesto": {
    name: "بيني بيستو",
    desc: "بيني باستا مع صوص الريحان البيتي، جبنة، ولمسة زيت زيتون بكر.",
    price: 25,
    tag: "طازج",
    image: "../assets/img/farfalle-pesto-900.webp",
  },
  "stroganoff-pasta": {
    name: "ستروجانوف باستا",
    desc: "فيتوتشيني باستا مع دجاج متبّل، فلفل أحمر، بصل، وفطر بصلصة كريمية وردية.",
    price: 30,
    tag: "طبق الشيف",
    image: "../assets/img/penne-saffron-900.webp",
  },
  "smoked-pasta": {
    name: "سموكد باستا",
    desc: "بيني باستا مدخّنة مع صوص ألفريدو وجبنة الشيدر.",
    price: 25,
    tag: "جديد",
    image: "../assets/img/penne-herb-900.webp",
  },
  tabbouleh: {
    name: "تبولة",
    desc: "بقدونس، بندورة، وبرغل، طازجة ومنعشة — تُحضّر عند الطلب.",
    price: 15,
    tag: "طازج",
    image: "../assets/img/tabbouleh-900.webp",
  },
  "chicken-nuggets": {
    name: "ناجتس الدجاج",
    desc: "قطع دجاج مقرمشة، مع صوص من اختيارك: باربيكيو، سويت تشيلي، بافلو، أو تيرياكي.",
    price: 15,
    tag: "جانبي",
    image: "../assets/img/chicken-crispy-900.webp",
  },
};

const cart = new Map();
const body = document.body;
const header = document.querySelector("[data-header]");
const progress = document.querySelector("[data-progress]");
const dishDialog = document.getElementById("dish-dialog");
const cartDialog = document.getElementById("cart-dialog");
const navDialog = document.getElementById("nav-dialog");
const navToggle = document.querySelector("[data-nav-open]");
const dishName = document.querySelector("[data-dish-name]");
const dishDesc = document.querySelector("[data-dish-desc]");
const dishPrice = document.querySelector("[data-dish-price]");
const dishTag = document.querySelector("[data-dish-tag]");
const dishImage = document.querySelector("[data-dish-image]");
const cartBody = document.querySelector("[data-cart-body]");
const cartTotal = document.querySelector("[data-cart-total]");
const cartCount = document.querySelector("[data-cart-count]");
const checkout = document.querySelector("[data-cart-checkout]");
const toast = document.querySelector("[data-toast]");
const previewBox = document.querySelector(".preview-image");
const previewImage = document.querySelector("[data-menu-image]");
const previewIndex = document.querySelector("[data-preview-index]");
const previewName = document.querySelector("[data-preview-name]");
const previewDesc = document.querySelector("[data-preview-desc]");
const previewPrice = document.querySelector("[data-preview-price]");
const previewAdd = document.querySelector("[data-preview-add]");
const filterNote = document.querySelector("[data-filter-note]");
let activeDish = null;
let previewDish = "fettuccine-mushroom";
let toastTimer;
let previewTimer;

function lockScroll() {
  body.style.overflow = "hidden";
}

function unlockScroll() {
  if (!dishDialog.open && !cartDialog.open && !navDialog.open)
    body.style.overflow = "";
}

function openDialog(dialog) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  lockScroll();
}

function closeDialog(dialog) {
  if (!dialog || !dialog.open) return;
  dialog.close();
  unlockScroll();
}

function formatPrice(value) {
  return `${value} ₪`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => toast.classList.remove("is-visible"),
    2600,
  );
}

function setPreview(id, instant = false) {
  const dish = dishes[id];
  if (!dish || id === previewDish) return;
  previewDish = id;
  previewBox.classList.add("is-swapping");
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(
    () => {
      previewImage.src = dish.image;
      previewName.textContent = dish.name;
      previewDesc.textContent = dish.desc;
      previewPrice.textContent = formatPrice(dish.price);
      const rows = [...document.querySelectorAll(".menu-row")].filter(
        (row) => !row.classList.contains("is-hidden"),
      );
      const index = rows.findIndex(
        (row) => row.querySelector("[data-preview]")?.dataset.preview === id,
      );
      previewIndex.textContent = String(index + 1).padStart(2, "0");
      previewBox.classList.remove("is-swapping");
    },
    instant ? 0 : 140,
  );
  document.querySelectorAll(".menu-row").forEach((row) => {
    row.classList.toggle(
      "is-active",
      row.querySelector("[data-preview]")?.dataset.preview === id,
    );
  });
}

function openDish(id) {
  const dish = dishes[id];
  if (!dish) return;
  activeDish = id;
  dishName.textContent = dish.name;
  dishDesc.textContent = dish.desc;
  dishPrice.textContent = formatPrice(dish.price);
  dishTag.textContent = dish.tag;
  dishImage.src = dish.image;
  dishImage.alt = dish.name;
  openDialog(dishDialog);
}

function renderCart() {
  const entries = [...cart.entries()];
  const total = entries.reduce(
    (sum, [id, qty]) => sum + dishes[id].price * qty,
    0,
  );
  const count = entries.reduce((sum, [, qty]) => sum + qty, 0);

  cartCount.textContent = String(count);
  cartTotal.textContent = formatPrice(total);

  if (entries.length === 0) {
    cartBody.innerHTML =
      '<p class="cart-empty">السلة فاضية. اختار طبق من القائمة وابدأ.</p>';
  } else {
    cartBody.innerHTML = entries
      .map(
        ([id, qty]) => `
          <div class="cart-item">
            <img src="${dishes[id].image}" alt="" width="64" height="64" />
            <div class="cart-item-main">
              <strong>${dishes[id].name}</strong>
              <span>${qty} × ${formatPrice(dishes[id].price)}</span>
            </div>
            <span class="cart-item-price">${formatPrice(dishes[id].price * qty)}</span>
            <button class="cart-remove" type="button" data-remove="${id}" aria-label="إزالة ${dishes[id].name}">
              <svg class="icon" aria-hidden="true"><use href="#i-close" /></svg>
            </button>
          </div>
        `,
      )
      .join("");
  }

  const lines = entries.map(
    ([id, qty]) =>
      `• ${dishes[id].name} × ${qty} — ${formatPrice(dishes[id].price * qty)}`,
  );
  const message = entries.length
    ? `مرحباً JPasta — بدي أطلب:\n${lines.join("\n")}\n\nالمجموع: ${formatPrice(total)}`
    : "مرحباً JPasta — بدي أطلب من القائمة";
  checkout.href = `https://wa.me/970566064976?text=${encodeURIComponent(message)}`;
}

function addToCart(id) {
  if (!dishes[id]) return;
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
  showToast(`أضفنا ${dishes[id].name} إلى طلبك`);
}

document.querySelectorAll("[data-dish]").forEach((button) => {
  button.addEventListener("click", () => openDish(button.dataset.dish));
});

document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => addToCart(button.dataset.add));
});

document.querySelector("[data-dish-add]").addEventListener("click", () => {
  if (!activeDish) return;
  addToCart(activeDish);
  closeDialog(dishDialog);
});

previewAdd.addEventListener("click", () => addToCart(previewDish));

document
  .querySelector("[data-dish-close]")
  .addEventListener("click", () => closeDialog(dishDialog));
document
  .querySelector("[data-cart-close]")
  .addEventListener("click", () => closeDialog(cartDialog));
document.querySelector("[data-cart-open]").addEventListener("click", () => {
  renderCart();
  openDialog(cartDialog);
});

cartBody.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove]");
  if (!remove) return;
  const id = remove.dataset.remove;
  const next = (cart.get(id) || 0) - 1;
  if (next > 0) cart.set(id, next);
  else cart.delete(id);
  renderCart();
});

[dishDialog, cartDialog, navDialog].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
  dialog.addEventListener("close", unlockScroll);
});

navToggle.addEventListener("click", () => {
  openDialog(navDialog);
  navToggle.setAttribute("aria-expanded", "true");
});

document.querySelector("[data-nav-close]").addEventListener("click", () => {
  closeDialog(navDialog);
  navToggle.setAttribute("aria-expanded", "false");
});

navDialog.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    closeDialog(navDialog);
    navToggle.setAttribute("aria-expanded", "false");
  });
});

function setActiveRow(row) {
  const id = row?.querySelector("[data-preview]")?.dataset.preview;
  if (id) setPreview(id);
}

document.querySelectorAll(".menu-row").forEach((row) => {
  row.addEventListener("pointerenter", () => setActiveRow(row));
  row.addEventListener("focusin", () => setActiveRow(row));
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });

    let visible = 0;
    document.querySelectorAll(".menu-row").forEach((row) => {
      const show = filter === "all" || row.dataset.category === filter;
      row.classList.toggle("is-hidden", !show);
      if (show) visible += 1;
    });

    filterNote.textContent = visible === 1 ? "طبق واحد" : `${visible} أطباق`;
    const first = document.querySelector(".menu-row:not(.is-hidden)");
    if (first) setActiveRow(first);
  });
});

function onScroll() {
  header.classList.toggle("is-scrolled", window.scrollY > 10);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
}

window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
  );
  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => element.classList.add("is-visible"));
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Hebron",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function updateLiveTime() {
  const parts = timeFormatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const minutes = hour * 60 + minute;
  const isOpen = minutes >= 13 * 60 || minutes < 60;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  document.querySelectorAll("[data-live-time]").forEach((node) => {
    node.textContent = time;
  });
  document.querySelectorAll("[data-open-label]").forEach((node) => {
    node.textContent = isOpen ? "مفتوح الآن" : "مغلق الآن";
  });
  document.querySelectorAll("[data-status-dot]").forEach((dot) => {
    dot.classList.toggle("is-open", isOpen);
  });
}

updateLiveTime();
window.setInterval(updateLiveTime, 60000);

document.querySelector("[data-year]").textContent = String(
  new Date().getFullYear(),
);
renderCart();
setPreview("fettuccine-mushroom", true);
