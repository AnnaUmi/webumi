/* Small helpers for the sale and the order form, on every page:
   - the sale's "N days left" ([data-sale-ends]) and the ticking countdown in the top strip ([data-sale-clock]), in the visitor's own time;
   - the order form fills the business name and "What does the business do?" from a link (?business=…&industry=…). */
(() => {
  document.querySelectorAll("[data-sale-ends]").forEach((el) => {
    const days = Math.ceil((new Date(el.dataset.saleEnds + "T23:59:59") - Date.now()) / 864e5);
    if (days >= 1 && days <= 60) el.textContent = ` · ${days === 1 ? "last day" : days + " days left"}`;
  });
  /* the strip above the menu: days, hours, minutes and seconds to the end of the sale, ticking; gone when it's over */
  document.querySelectorAll("[data-sale-clock]").forEach((el) => {
    const end = new Date(el.dataset.saleClock + "T23:59:59").getTime(), two = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const s = Math.floor((end - Date.now()) / 1000);
      if (s < 0) { el.textContent = ""; clearInterval(timer); return; }
      el.innerHTML = `<b>${Math.floor(s / 86400)}<i>d</i></b><b>${two(Math.floor(s / 3600) % 24)}<i>h</i></b><b>${two(Math.floor(s / 60) % 60)}<i>m</i></b><b>${two(s % 60)}<i>s</i></b>`;
    };
    const timer = setInterval(tick, 1000); tick();
  });
  const q = new URLSearchParams(location.search);
  [["business", 40], ["industry", 60]].forEach(([name, max]) => {
    const v = q.get(name), field = document.querySelector(`#orderForm [name="${name}"]`);
    if (v && field && !field.value) { field.value = v.slice(0, max); field.dispatchEvent(new Event("input", { bubbles: true })); }
  });
})();
