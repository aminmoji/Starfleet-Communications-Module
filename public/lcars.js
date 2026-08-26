document.addEventListener("DOMContentLoaded", () => {
  const scrollLink = document.querySelector("#scroll-top");

  if (scrollLink) {
    const updateScrollLink = () => {
      scrollLink.hidden = window.scrollY <= 100;
    };

    updateScrollLink();
    window.addEventListener("scroll", updateScrollLink, { passive: true });
    scrollLink.addEventListener("click", (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  document.querySelectorAll("[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!window.confirm(form.dataset.confirm)) {
        event.preventDefault();
      }
    });
  });
});
