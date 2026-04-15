import { FolderGit2, GitPullRequest, Home, Settings } from "lucide-react"
import { Icons } from "@renderer/components/icons"
import { Link, useRouterState } from "@tanstack/react-router"
import { SidebarAccountsMenu } from "@renderer/components/SidebarAccountsMenu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@renderer/components/ui/sidebar"
import { ListItem } from "@renderer/components/ui/list"
import { cn } from "@renderer/lib/utils"

const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Repos",
    url: "/repos",
    icon: FolderGit2,
  },
  {
    title: "PRs",
    url: "/prs",
    icon: GitPullRequest,
  },
  {
    title: "Bugs",
    url: "/bugs",
    icon: Icons.Bug,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]

function NavItem({ item }: { item: (typeof items)[0] }) {
  const isActive = useRouterState({ select: (s) => s.location.pathname === item.url })
  return (
    <SidebarMenuItem>
      <Link to={item.url} className="block">
        <ListItem
          enableHover={!isActive}
          className={cn(isActive ? "bg-sidebar-accent text-sidebar-primary" : "", "py-1.5")}
        >
          <item.icon className="size-4 shrink-0" />
          <span>{item.title}</span>
        </ListItem>
      </Link>
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 flex items-center justify-center border-b border-sidebar-border" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2 font-bold text-lg px-4 w-full">
          <span className="truncate"></span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pb-0">
          <SidebarGroupContent>
            <SidebarAccountsMenu />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <NavItem key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
      <SidebarRail />
    </Sidebar>
  )
}
