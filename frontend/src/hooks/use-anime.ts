"use client";

import { useEffect, useRef } from "react";
import { createScope } from "animejs";

type SetupFn<T extends HTMLElement> = (root: T) => () => void;

export function useAnime<T extends HTMLElement>(setup: SetupFn<T>, deps: unknown[] = []) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cleanup = setup(el);
    return cleanup;
  }, deps);

  return ref;
}

export function animeScope(root: HTMLElement) {
  return createScope({ root });
}
