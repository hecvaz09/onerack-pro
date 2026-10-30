"use client";

import { Popover } from "@base-ui/react/popover";
import { ThemePicker } from "./theme-picker";
import styles from "./appearance-menu.module.css";

// Portal outside the frosted header: its backdrop filter creates a stacking
// context that a larger z-index on an in-header dropdown cannot escape.
export function AppearanceMenu() {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.trigger} aria-label="Appearance settings">
        <span className={styles.chevron} aria-hidden="true">▾</span>
        Appearance
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className={`${styles.positioner} appearance-menu`}
          positionMethod="fixed"
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={16}
          collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }}
        >
          <Popover.Popup className={styles.panel} aria-label="Appearance settings">
            <ThemePicker />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
