import Box from "@mui/material/Box";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Grow from "@mui/material/Grow";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

/** How long the pointer may be off both the button and the menu before it closes, to cross the gap between them. */
const CLOSE_DELAY_MS = 150;

/**
 * A dropdown that opens when a mouse hovers its button, and on click or tap. Unlike MUI's Menu it has no backdrop,
 * so moving the mouse away closes it. Escape and clicking elsewhere close it too.
 */
export function HoverMenu({
  trigger,
  children,
  placement = "bottom-start",
  minWidth = 220,
}: {
  /** The button; it gets whether the menu is open, for its aria-expanded. */
  trigger: (open: boolean) => ReactNode;
  /** The menu's items; call `close` after choosing one. */
  children: (close: () => void) => ReactNode;
  placement?: "bottom-start" | "bottom-end";
  minWidth?: number;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  // Opened by a click or a key, not a hover: the first item takes the focus, for the keyboard.
  const [focusFirst, setFocusFirst] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelClose = () => clearTimeout(closeTimer.current);
  const close = () => {
    cancelClose();
    setOpen(false);
  };
  const closeSoon = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  useEffect(() => cancelClose, []);

  return (
    <>
      {/* The button's clicks and keys bubble up to here. */}
      <Box
        component="span"
        ref={setAnchor}
        sx={{ display: "inline-flex", flexShrink: 0 }}
        onClick={() => {
          cancelClose();
          // A click on a menu the mouse just opened keeps it open; otherwise a click toggles it.
          if (open && !focusFirst) {
            setFocusFirst(true);
            return;
          }
          setFocusFirst(true);
          setOpen((was) => !was);
        }}
        onPointerEnter={(event: PointerEvent) => {
          // Only a mouse hovers; a tap is handled as a click.
          if (event.pointerType !== "mouse") return;
          cancelClose();
          setFocusFirst(false);
          setOpen(true);
        }}
        onPointerLeave={closeSoon}
      >
        {trigger(open)}
      </Box>
      <Popper open={open && anchor !== null} anchorEl={anchor} placement={placement} transition sx={{ zIndex: (theme) => theme.zIndex.modal }}>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} style={{ transformOrigin: placement === "bottom-end" ? "right top" : "left top" }} timeout={150}>
            <Paper elevation={8} onPointerEnter={cancelClose} onPointerLeave={closeSoon} sx={{ minWidth, mt: 0.5 }}>
              <ClickAwayListener
                onClickAway={(event) => {
                  // A click on the button toggles it instead.
                  if (anchor?.contains(event.target as Node)) return;
                  close();
                }}
              >
                <MenuList
                  autoFocusItem={focusFirst}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" || event.key === "Tab") {
                      close();
                      if (event.key === "Escape") anchor?.querySelector<HTMLElement>("button, a")?.focus();
                    }
                  }}
                >
                  {children(close)}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}
