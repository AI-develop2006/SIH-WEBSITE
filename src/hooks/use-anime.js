"use client";

import { useEffect, useRef } from "react";
import { createScope } from "animejs";

export function useAnime(setup, deps = []) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cleanup = setup(el);
    return cleanup;
  }, deps);

  return ref;
}

export function animeScope(root) {
  return createScope({ root });
}
