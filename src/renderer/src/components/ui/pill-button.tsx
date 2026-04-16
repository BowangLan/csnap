import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@renderer/lib/utils"

const pillButtonVariants = cva(
  [
    // Layout & Display
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none",

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
          "border bg-transparent hover:bg-accent hover:text-accent-foreground dark:border-input",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",

        red: 'bg-red-500 text-white hover:bg-red-500/90',
        orange: 'bg-orange-500 text-white hover:bg-orange-500/90',
        amber: 'bg-amber-400 text-white hover:bg-amber-400/90',
        blue: 'bg-blue-500 text-white hover:bg-blue-500/90',
        muted: 'bg-muted-foreground text-white hover:bg-muted-foreground/90',
        green: 'bg-green-500 text-white hover:bg-green-500/90',

        "red-outline": 'border-red-500/50 border text-red-500 hover:bg-red-500/10 hover:text-red-500/90',
        "orange-outline": 'border-orange-500/50 border text-orange-500 hover:bg-orange-500/10 hover:text-orange-500/90',
        "amber-outline": 'border-amber-400/50 border text-amber-400 hover:bg-amber-400/10 hover:text-amber-400/90',
        "blue-outline": 'border-blue-500/50 border text-blue-500 hover:bg-blue-500/10 hover:text-blue-500/90',
        "muted-outline": 'border-muted-foreground/50 border text-muted-foreground hover:bg-muted-foreground/10 hover:text-muted-foreground/90',
        "green-outline": 'border-green-500/50 border text-green-500 hover:bg-green-500/10 hover:text-green-500/90',
      },
      size: {
        default: "h-6 px-2 py-0 has-[>svg]:px-2 has-[>svg]:gap-1.5 text-xs",
        sm: "h-5 rounded-md gap-1.5 px-2 has-[>svg]:px-2 text-xs",
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

export type PillButtonVariants = VariantProps<typeof pillButtonVariants>["variant"]

const PillButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
  VariantProps<typeof pillButtonVariants> & {
    asChild?: boolean
  }
>(function PillButton({ className, variant, size, asChild = false, ...props }, ref) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(pillButtonVariants({ variant, size }), className)}
      {...props}
    />
  )
})
PillButton.displayName = "PillButton"

export { PillButton, pillButtonVariants }
