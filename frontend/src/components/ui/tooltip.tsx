"use client";

import * as React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

export const TooltipProvider = RadixTooltip.Provider;

export const Tooltip = RadixTooltip.Root;

export const TooltipTrigger = RadixTooltip.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof RadixTooltip.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        ref={ref}
        sideOffset={sideOffset}
        className={
          "z-50 overflow-hidden rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-xs text-white shadow-md backdrop-blur " +
          (className ?? "")
        }
        {...props}
      />
    </RadixTooltip.Portal>
  );
});