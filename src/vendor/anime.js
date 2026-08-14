const EASE = {
  easeOutCubic: "cubic-bezier(0.33, 1, 0.68, 1)",
  easeInCubic: "cubic-bezier(0.32, 0, 0.67, 0)",
};

function frames(opts) {
  const from = {};
  const to = {};
  if (opts.opacity != null) {
    if (Array.isArray(opts.opacity)) {
      from.opacity = String(opts.opacity[0]);
      to.opacity = String(opts.opacity[1]);
    } else {
      to.opacity = String(opts.opacity);
    }
  }
  if (opts.translateY != null) {
    if (Array.isArray(opts.translateY)) {
      from.transform = "translateY(" + opts.translateY[0] + "px)";
      to.transform = "translateY(" + opts.translateY[1] + "px)";
    } else {
      to.transform = "translateY(" + opts.translateY + "px)";
    }
  }
  if (opts.color) {
    to.color = opts.color;
  }
  return [from, to];
}

function list(targets) {
  if (!targets) return [];
  if (targets.nodeType) return [targets];
  if (typeof targets.length === "number") return Array.from(targets);
  return [targets];
}

function anime(opts) {
  const duration = opts.duration ?? 340;
  const delay = opts.delay ?? 0;
  const easing = EASE[opts.easing] || "ease";
  const kf = frames(opts);
  const anims = [];
  for (const el of list(opts.targets)) {
    if (!el || !el.animate) continue;
    anims.push(
      el.animate(kf, { duration, delay, easing, fill: "forwards" }),
    );
  }
  if (opts.complete) {
    Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(opts.complete);
  }
  return {
    pause() {
      anims.forEach((a) => a.cancel());
    },
  };
}

anime.remove = function (el) {
  if (!el || !el.getAnimations) return;
  el.getAnimations().forEach((a) => a.cancel());
};

export default anime;
