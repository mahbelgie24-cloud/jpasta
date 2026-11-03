const { chromium } = require("playwright");
const fs = require("fs");

const target = process.argv[2] || "v1-atelier";
const name = process.argv[3] || target;
const base = "http://localhost:4173";

const captureCSS = `
  html { scroll-behavior: auto !important; }
  .js .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
  .site-header { position: static !important; }
  .skip-link { display: none !important; }
`;

async function prepare(page) {
  await page.goto(`${base}/${target}/`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: captureCSS });
  await page.waitForTimeout(250);
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.7);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 250));
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
}

(async () => {
  fs.mkdirSync("design-lab/screenshots", { recursive: true });
  const browser = await chromium.launch();
  const errors = [];

  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  desktop.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  desktop.on("pageerror", (error) => errors.push(error.message));
  await prepare(desktop);
  await scrollThrough(desktop);
  const overflow = await desktop.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  await desktop.screenshot({
    path: `design-lab/screenshots/${name}-desktop.png`,
    fullPage: true,
  });
  console.log("desktop overflow", overflow);

  const tablet = await browser.newPage({
    viewport: { width: 768, height: 1024 },
  });
  await prepare(tablet);
  await scrollThrough(tablet);
  await tablet.screenshot({
    path: `design-lab/screenshots/${name}-tablet.png`,
    fullPage: true,
  });

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await prepare(mobile);
  await scrollThrough(mobile);
  const mobileOverflow = await mobile.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  await mobile.screenshot({
    path: `design-lab/screenshots/${name}-mobile.png`,
    fullPage: true,
  });
  console.log("mobile overflow", mobileOverflow);

  console.log("console errors", errors.length ? errors : "none");
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
