"use client";

import { useEffect } from "react";

type PageTitleSyncProps = {
  title: string;
};

export function PageTitleSync({ title }: PageTitleSyncProps) {
  useEffect(() => {
    document.title = title;

    const animationFrameIds: number[] = [];
    const timeoutIds: number[] = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      animationFrameIds.push(
        window.requestAnimationFrame(() => {
          document.title = title;
        })
      );
    }

    [120, 360, 720, 1200].forEach((delay) => {
      timeoutIds.push(
        window.setTimeout(() => {
          document.title = title;
        }, delay)
      );
    });

    return () => {
      animationFrameIds.forEach((animationFrameId) => window.cancelAnimationFrame(animationFrameId));
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [title]);

  return null;
}
