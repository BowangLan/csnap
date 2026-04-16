import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@renderer/lib/utils"

const pillButtonVariants = cva(
  [
    // Layout & Display
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",

    // Sizing
    "rounded-lg text-sm font-medium",

    // Effects / Animation
    "transition-all",

    // State - Disabled
    "disabled:pointer-events-none disabled:opacity-50",

    // SVG child styling
    "[&_svg]:pointer-events-none",
    "[&_svg:not([class*='size-'])]:size-4",
    "shrink-0 [&_svg]:shrink-0",

    // Focus and Border States
    "outline-none",
    "focus-visible:border-ring",
    "focus-visible:ring-ring/50",
    "focus-visible:ring-[3px]",

    // Validation/Error States
    "aria-invalid:ring-destructive/20",
    "dark:aria-invalid:ring-destructive/40",
    "aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-6 px-2.5 py-05 has-[>svg]:px-3 text-xs",
        sm: "h-5 rounded-md gap-1.5 px-2 has-[>svg]:px-2.5 text-xs",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4 text-sm",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function PillButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof pillButtonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(pillButtonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { PillButton, pillButtonVariants }
