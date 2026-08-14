"use client";

import anime from "@/vendor/anime.js";

export function ink(el: HTMLElement | null, to: string, duration = 340) {
  if (!el) return;
  anime.remove(el);
  anime({
    targets: el,
    color: to,
    duration,
    easing: "easeOutCubic",
  });
}
