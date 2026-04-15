import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, ChevronDown, Users, XCircle } from 'lucide-react'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Badge } from '@renderer/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import type { GithubAccount } from '../../../shared/github'

export function SidebarAccountsMenu() {
  const snapshot = useGithubSnapshot()
  const [accounts, setAccounts] = useState<GithubAccount[]>([])
  const [switchingLogin, setSwitchingLogin] = useState<string | null>(null)

  useEffect(() => {
    window.api.github.listAccounts().then(setAccounts).catch(() => setAccounts([]))
  }, [snapshot.auth.activeLogin])

  const handleSwitchAccount = async (login: string) => {
    setSwitchingLogin(login)
    try {
      await window.api.github.switchAccount(login)
      const updated = await window.api.github.listAccounts()
      setAccounts(updated)
      toast.success(`Switched to ${login}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to switch account.')
    } finally {
      setSwitchingLogin(null)
    }
  }

  const label = snapshot.auth.activeLogin ?? 'Account'

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip="GitHub accounts" className="w-full data-[state=open]:bg-sidebar-accent">
              <Users />
              <span className="flex min-w-0 flex-1 items-center gap-1">
                <span className="truncate">{label}</span>
                <ChevronDown className="size-4 shrink-0 opacity-50" />
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="start" side="bottom">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium">Accounts</span>
                <span className="text-[11px] text-muted-foreground leading-snug">
                  GitHub accounts authenticated via the gh CLI.
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accounts.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">No accounts found.</div>
            ) : (
              accounts.map((account) => (
                <DropdownMenuItem
                  key={`${account.hostname}/${account.login}`}
                  disabled={account.isActive || switchingLogin !== null}
                  onSelect={() => {
                    if (!account.isActive) void handleSwitchAccount(account.login)
                  }}
                  className="cursor-pointer items-start gap-3 py-2.5"
                >
                  <div className="mt-0.5 shrink-0">
                    {account.isActive ? (
                      <CheckCircle2 className="size-4 text-green-500" />
                    ) : (
                      <XCircle className="size-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{account.login}</p>
                    <p className="truncate text-xs text-muted-foreground">{account.hostname}</p>
                  </div>
                  {account.isActive && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      Active
                    </Badge>
                  )}
                  {!account.isActive && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {switchingLogin === account.login ? 'Switching…' : 'Switch'}
                    </span>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
