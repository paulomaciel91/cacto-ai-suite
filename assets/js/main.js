(function () {
  "use strict";

  var revealItems = document.querySelectorAll(".hero-copy, .hero-panel, .card, .site-footer");

  revealItems.forEach(function (item) {
    item.classList.add("reveal");
  });

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.18
      }
    );

    revealItems.forEach(function (item) {
      observer.observe(item);
    });
  } else {
    revealItems.forEach(function (item) {
      item.classList.add("is-visible");
    });
  }

  document.querySelectorAll(".btn-soon").forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      button.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-3px)" },
          { transform: "translateX(3px)" },
          { transform: "translateX(0)" }
        ],
        {
          duration: 240,
          easing: "ease-out"
        }
      );
    });
  });
})();
