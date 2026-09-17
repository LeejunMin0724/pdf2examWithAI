"use client";

import { useEffect } from "react";

/**
 * Scroll storytelling engine.
 *
 * Entrance:
 * - Any element with [data-reveal] fades/scales/translates in when it enters
 *   the viewport (IntersectionObserver, once per element).
 * - [data-reveal-group] containers additionally stagger their [data-reveal-item]
 *   children for the "natural appearance" sequence.
 *
 * Exit (scroll-story transitions):
 * - Elements with [data-reveal-exit] fade/scale/translate OUT once they have
 *   fully scrolled past the top of the viewport, and transition back when the
 *   user scrolls up again — so outgoing content dissolves as new content continues.
 *
 * MutationObserver re-scans when React mounts late content (async sections),
 * so nothing needs to opt in manually.
 */
export function ScrollReveal() {
  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" },
    );

    const scan = () => {
      document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => {
        const group = el.closest<HTMLElement>("[data-reveal-group]");
        if (group instanceof HTMLElement) {
          const items = group.querySelectorAll("[data-reveal-item]");
          const index = Array.prototype.indexOf.call(items, el);
          if (index > 0) (el as HTMLElement).style.setProperty("--reveal-delay", `${Math.min(index * 90, 450)}ms`);
        }
        observer.observe(el);
      });
      updateExits();
    };

    // Exit: begin dissolving a section once its top edge has scrolled just past
    // the viewport top — outgoing content fades/drifts while new content continues.
    // Small buffer (+32) and restore point (0) give hysteresis so it never flickers.
    const EXIT_PAST = -32;
    let frame = 0;
    const updateExits = () => {
      frame = 0;
      document.querySelectorAll<HTMLElement>("[data-reveal-exit]").forEach((el) => {
        const top = el.getBoundingClientRect().top;
        const past = top < (el.classList.contains("is-exiting") ? 0 : EXIT_PAST);
        el.classList.toggle("is-exiting", past);
      });
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateExits);
    };

    scan();
    const mutation = new MutationObserver(scan);
    mutation.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      observer.disconnect();
      mutation.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
