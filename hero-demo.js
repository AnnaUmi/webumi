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
})();
