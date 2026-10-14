"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
const subscribe = () => () => {};
export function useHydrated() { return useSyncExternalStore(subscribe, () => true, () => false); }
export function FormFeedback({ message, failed = false, id }: { message: string; failed?: boolean; id?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message) ref.current?.focus(); }, [message]);
  return message ? <p id={id} ref={ref} tabIndex={-1} role={failed ? "alert" : "status"} className={failed ? "form-error" : "form-success"}>{message}</p> : null;
}
