/* Small helpers for the sale and the order form, on every page:
   - the sale's "N days left" ([data-sale-ends], from catalog.json's sale), counted in the visitor's own time;
   - the order form fills the business name and "What does the business do?" from a link (?business=…&industry=…). */
(() => {
  document.querySelectorAll("[data-sale-ends]").forEach((el) => {
    const days = Math.ceil((new Date(el.dataset.saleEnds + "T23:59:59") - Date.now()) / 864e5);
    if (days >= 1 && days <= 60) el.textContent = ` · ${days === 1 ? "last day" : days + " days left"}`;
  });
  const q = new URLSearchParams(location.search);
  [["business", 40], ["industry", 60]].forEach(([name, max]) => {
    const v = q.get(name), field = document.querySelector(`#orderForm [name="${name}"]`);
    if (v && field && !field.value) { field.value = v.slice(0, max); field.dispatchEvent(new Event("input", { bubbles: true })); }
  });

  /* Home hero: the scene shifts a few pixels against the mouse, for depth (not on touch screens or with reduced motion) */
  const hero = document.getElementById("setHero"), art = document.getElementById("setArt");
  if (hero && art && matchMedia("(hover: hover) and (pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hero.addEventListener("mousemove", (e) => {
      const h = hero.getBoundingClientRect();
      const mx = (e.clientX - h.left) / h.width - .5, my = (e.clientY - h.top) / h.height - .5;
      art.style.transform = `scale(1.03) translate(${(-mx * 14).toFixed(1)}px, ${(-my * 9).toFixed(1)}px)`;
    });
    hero.addEventListener("mouseleave", () => { art.style.transform = ""; });
  }
})();
