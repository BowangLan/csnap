import { cn } from "@renderer/lib/utils"

export const ListItem = ({ children, enableHover = true, className, ...props }: { children: React.ReactNode, enableHover?: boolean, className?: string } & React.ComponentProps<"div">) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3.5 py-2.5",
        "transition-all duration-100 ease-out",
        enableHover && "hover:bg-muted active:bg-accent/60",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export const List = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {children}
    </div>
  )
}