"use client";

import { useEffect, useRef } from "react";

type SetupFn<T extends HTMLElement> = (root: T) => () => void;

export function useAnime<T extends HTMLElement>(setup: SetupFn<T>, deps: unknown[] = []) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cleanup = setup(el);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
