"use client";

import { useEffect, useState } from "react";

/** Keep server-rendered controls disabled until their event handlers are attached. */
export function useClientReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
