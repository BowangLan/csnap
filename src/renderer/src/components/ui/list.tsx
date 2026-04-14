import { cn } from "@renderer/lib/utils"

export const ListItem = ({ children, enableHover = true, className }: { children: React.ReactNode, enableHover?: boolean, className?: string }) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2",
        "transition-all duration-200 ease-out",
        enableHover && "hover:bg-muted/80 active:bg-muted",
        className
      )}
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