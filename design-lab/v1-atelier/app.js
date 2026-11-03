const dishes = {
  "fettuccine-mushroom": {
    name: "فيتوتشيني مع فطر",
    desc: "فيتوتشيني باستا مع فطر طازج، جبنة بارميزان، وريحان — بصلصة ألفريدو كريمية تُحضّر طازجة كل يوم.",
    price: 20,
    tag: "الأكثر طلباً",
    image: "../assets/img/fettuccine-mushroom-900.webp",
  },
  "penne-pesto": {
    name: "بيني بيستو",
    desc: "بيني باستا مع صوص الريحان البيتي، جبنة، ولمسة من زيت الزيتون البكر.",
    price: 25,
    tag: "طازج",
    image: "../assets/img/farfalle-pesto-900.webp",
  },
  "stroganoff-pasta": {
    name: "ستروجانوف باستا",
    desc: "فيتوتشيني باستا مع قطع دجاج متبّل، فلفل أحمر، بصل، وفطر بصلصة كريمية وردية.",
    price: 30,
    tag: "طبق الشيف",
    image: "../assets/img/penne-saffron-900.webp",
  },
  "fettuccine-alfredo": {
    name: "فيتوتشيني ألفريدو",
    desc: "فيتوتشيني باستا مع صوص ألفريدو كريمي وجبنة — الوصفة الكلاسيكية بدون تعقيد.",
    price: 20,
    tag: "كلاسيكي",
    image: "../assets/img/fettuccine-cream-900.webp",
  },
  "smoked-pasta": {
    name: "سموكد باستا",
    desc: "بيني باستا مدخّنة مع صوص ألفريدو وجبنة الشيدر — نكهة غنية ودخانية.",
    price: 25,
    tag: "جديد",
    image: "../assets/img/penne-herb-900.webp",
  },
};

const cart = new Map();
const body = document.body;
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
const preview = document.querySelector(".dish-preview");
const previewImage = document.querySelector("[data-preview-image]");
let activeDish = null;
let toastTimer;

function lockScroll() {
  body.style.overflow = "hidden";
}

function unlockScroll() {
  if (!dishDialog.open && !cartDialog.open && !navDialog.open) {
    body.style.overflow = "";
  }
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
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
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
  cartCount.dataset.empty = count === 0 ? "true" : "false";
  cartTotal.textContent = formatPrice(total);

  if (entries.length === 0) {
    cartBody.innerHTML =
      '<p class="cart-empty">السلة فاضية — اختار طبق من القائمة وابدأ.</p>';
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

document.querySelector("[data-dish-add]").addEventListener("click", () => {
  if (!activeDish) return;
  addToCart(activeDish);
  closeDialog(dishDialog);
});

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

const header = document.querySelector("[data-header]");
function onScroll() {
  header.classList.toggle("is-scrolled", window.scrollY > 8);
  if (preview.classList.contains("is-visible"))
    preview.classList.remove("is-visible");
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const finePointer = window.matchMedia("(pointer: fine)");
document.querySelectorAll("[data-preview]").forEach((row) => {
  row.addEventListener("pointerenter", () => {
    if (!finePointer.matches) return;
    previewImage.src = row.dataset.preview;
    preview.classList.add("is-visible");
  });
  row.addEventListener("pointerleave", () => {
    preview.classList.remove("is-visible");
  });
  row.addEventListener("pointermove", (event) => {
    if (!finePointer.matches) return;
    preview.style.left = `${event.clientX}px`;
    preview.style.top = `${event.clientY}px`;
  });
});

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
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
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

function updateOpenStatus() {
  const parts = timeFormatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const minutes = hour * 60 + minute;
  const isOpen = minutes >= 13 * 60 || minutes < 60;
  document.querySelectorAll("[data-open-label]").forEach((label) => {
    label.textContent = isOpen ? "مفتوح الآن" : "مغلق الآن — نفتح ١:٠٠ ظهراً";
  });
  document.querySelectorAll("[data-status-dot]").forEach((dot) => {
    dot.classList.toggle("is-open", isOpen);
  });
}

updateOpenStatus();
window.setInterval(updateOpenStatus, 60000);

document.querySelector("[data-year]").textContent = String(
  new Date().getFullYear(),
);
renderCart();
