import { Fragment } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { ALL_SHORTCUT_GROUPS, type ShortcutGroup } from "@/features/shortcuts/shortcutGroups";

type ShortcutsHelpOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups?: ShortcutGroup[];
};

export function ShortcutsHelpOverlay({
  open,
  onOpenChange,
  groups = ALL_SHORTCUT_GROUPS,
}: ShortcutsHelpOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <span className="font-mono">?</span> to toggle this list.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.title} className="flex flex-col gap-2">
              <h3 className="text-foreground/80 text-[11px] font-semibold tracking-[0.14em] uppercase">
                {group.title}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {group.shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.description}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-muted-foreground">{shortcut.description}</span>
                    <span className="flex items-center gap-1">
                      {shortcut.keys.map((key, index) => (
                        <Fragment key={key}>
                          {index > 0 ? (
                            <span className="text-muted-foreground/60 text-xs">or</span>
                          ) : null}
                          <Kbd>{key}</Kbd>
                        </Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
