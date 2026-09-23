"use client";
import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ComponentProps,
} from "react";
/** Fits content after edits, undo, tab changes, and changes to the available width. */
export function Textarea({
  ref,
  value,
  defaultValue,
  onInput,
  className = "",
  rows = 2,
  ...props
}: ComponentProps<"textarea">) {
  const element = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => element.current!);
  function fit() {
    const node = element.current;
    if (!node || node.clientWidth === 0) return;
    // Reset first so deleting text shrinks the control as well as typing growing it.
    node.style.height = "auto";
    const css = getComputedStyle(node);
    const border =
      parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
    node.style.height = node.scrollHeight + border + "px";
  }
  useLayoutEffect(fit, [value, defaultValue, rows]);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    let width = -1;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth !== width) {
        width = node.clientWidth;
        fit();
      }
    });
    observer.observe(node);
    let mounted = true;
    document.fonts.ready.then(() => {
      if (mounted) fit();
    });
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, []);
  return (
    <textarea
      {...props}
      ref={element}
      value={value}
      defaultValue={defaultValue}
      rows={rows}
      className={"auto-textarea " + className}
      onInput={(e) => {
        fit();
        onInput?.(e);
      }}
    />
  );
}
