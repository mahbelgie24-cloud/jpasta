const dishes = {
  "fettuccine-mushroom": {
    name: "فيتوتشيني مع فطر",
    desc: "فيتوتشيني باستا مع فطر طازج، جبنة بارميزان، وريحان، بصلصة ألفريدو كريمية تُحضّر كل صباح.",
    price: 20,
    tag: "الأكثر طلباً",
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
  "fettuccine-alfredo": {
    name: "فيتوتشيني ألفريدو",
    desc: "فيتوتشيني باستا مع صوص ألفريدو كريمي وجبنة — الوصفة الكلاسيكية.",
    price: 20,
    tag: "كلاسيكي",
    image: "../assets/img/fettuccine-cream-900.webp",
  },
};

const moods = {
  creamy: "fettuccine-mushroom",
  fresh: "penne-pesto",
  bold: "stroganoff-pasta",
};

const cart = new Map();
const body = document.body;
const header = document.querySelector("[data-header]");
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
const moodCard = document.querySelector("[data-mood-card]");
const moodImage = document.querySelector("[data-mood-image]");
const moodName = document.querySelector("[data-mood-name]");
const moodDesc = document.querySelector("[data-mood-desc]");
const moodPrice = document.querySelector("[data-mood-price]");
const moodAdd = document.querySelector("[data-mood-add]");
const rail = document.querySelector("[data-rail]");
let activeDish = null;
let currentMood = "creamy";
let toastTimer;
let moodTimer;
let dragState = null;
let dragged = false;

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

function setMood(key) {
  const id = moods[key];
  const dish = dishes[id];
  if (!dish) return;
  currentMood = key;
  document.querySelectorAll("[data-mood]").forEach((button) => {
    const active = button.dataset.mood === key;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  moodCard.classList.add("is-changing");
  window.clearTimeout(moodTimer);
  moodTimer = window.setTimeout(() => {
    moodImage.src = dish.image;
    moodImage.alt = dish.name;
    moodName.textContent = dish.name;
    moodDesc.textContent = dish.desc;
    moodPrice.textContent = formatPrice(dish.price);
    moodAdd.dataset.moodAdd = id;
    moodCard.classList.remove("is-changing");
  }, 170);
}

document.querySelectorAll("[data-dish]").forEach((button) => {
  button.addEventListener("click", () => openDish(button.dataset.dish));
});

document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => addToCart(button.dataset.add));
});

document.querySelectorAll("[data-mood]").forEach((button) => {
  button.addEventListener("click", () => setMood(button.dataset.mood));
});

moodAdd.addEventListener("click", () => {
  const id = moods[currentMood];
  if (id) addToCart(id);
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

function railStep(direction) {
  const card = rail.querySelector(".ticket");
  const amount = card
    ? card.getBoundingClientRect().width + 18
    : rail.clientWidth * 0.8;
  const isRtl = getComputedStyle(rail).direction === "rtl";
  const sign = isRtl ? -1 : 1;
  rail.scrollBy({ left: sign * direction * amount, behavior: "smooth" });
}

document
  .querySelector("[data-rail-next]")
  .addEventListener("click", () => railStep(1));
document
  .querySelector("[data-rail-prev]")
  .addEventListener("click", () => railStep(-1));

rail.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    railStep(1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    railStep(-1);
  }
});

rail.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  dragState = {
    startX: event.clientX,
    startLeft: rail.scrollLeft,
    pointerId: event.pointerId,
  };
  dragged = false;
});

rail.addEventListener("pointermove", (event) => {
  if (!dragState) return;
  const delta = event.clientX - dragState.startX;
  if (!dragged && Math.abs(delta) > 6) {
    dragged = true;
    rail.classList.add("is-dragging");
    rail.setPointerCapture(dragState.pointerId);
  }
  if (dragged) rail.scrollLeft = dragState.startLeft - delta;
});

function endDrag() {
  if (!dragState) return;
  if (rail.hasPointerCapture(dragState.pointerId)) {
    rail.releasePointerCapture(dragState.pointerId);
  }
  dragState = null;
  rail.classList.remove("is-dragging");
  window.setTimeout(() => {
    dragged = false;
  }, 40);
}

rail.addEventListener("pointerup", endDrag);
rail.addEventListener("pointercancel", endDrag);
rail.addEventListener("pointerleave", endDrag);
rail.addEventListener(
  "click",
  (event) => {
    if (!dragged) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true,
);

function onScroll() {
  header.classList.toggle("is-scrolled", window.scrollY > 8);
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
