import { useEffect, useState, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behaviour a modal dialog needs: Tab and Shift+Tab stay inside it, and when it closes, focus goes back to
 * what opened it (otherwise it drops to the top of the page and a keyboard user has to start again).
 */
export function useDialogFocus(dialog: RefObject<HTMLElement | null>) {
  // Read while rendering, before the dialog's own autofocus moves focus into it.
  const [opener] = useState(() => (typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialog.current) return;
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null || item === document.activeElement);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialog.current.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [dialog, opener]);
}
