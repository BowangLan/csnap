import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Bell, RefreshCw, Users, CheckCircle2, XCircle, Loader2, Volume2 } from 'lucide-react'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Card, CardContent, CardHeader } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Separator } from '@renderer/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { type GithubAccount, MACOS_NOTIFICATION_SOUNDS, type MacOsNotificationSound } from '../../../shared/github'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-md border bg-muted/50 p-1.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
  noBorder,
}: {
  label: string
  description?: string
  children: React.ReactNode
  noBorder?: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
      {!noBorder && <Separator />}
    </>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function Settings() {
  const snapshot = useGithubSnapshot()
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(
    String(snapshot.settings.refreshIntervalSeconds),
  )
  const [soundOnPrUpdates, setSoundOnPrUpdates] = useState(snapshot.settings.soundOnPrUpdates)
  const [notificationSound, setNotificationSound] = useState<MacOsNotificationSound>(
    snapshot.settings.notificationSound,
  )
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [accounts, setAccounts] = useState<GithubAccount[]>([])
  const [switchingLogin, setSwitchingLogin] = useState<string | null>(null)

  useEffect(() => {
    setRefreshIntervalSeconds(String(snapshot.settings.refreshIntervalSeconds))
    setSoundOnPrUpdates(snapshot.settings.soundOnPrUpdates)
    setNotificationSound(snapshot.settings.notificationSound)
  }, [
    snapshot.settings.refreshIntervalSeconds,
    snapshot.settings.soundOnPrUpdates,
    snapshot.settings.notificationSound,
  ])

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

  const handleTestSound = async () => {
    setIsTesting(true)
    try {
      await window.api.github.playSound(notificationSound)
    } catch {
      toast.error('Failed to play sound.')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await window.api.github.updateSettings({
        refreshIntervalSeconds: Number(refreshIntervalSeconds),
        soundOnPrUpdates,
        notificationSound,
      })
      toast.success('Settings saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your preferences and account.</p>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader
            icon={Bell}
            title="Notifications"
            description="Control how you're alerted to pull request activity."
          />
        </CardHeader>
        <CardContent className="pt-0">
          <Separator />
          <SettingRow
            label="Sound on pull request updates"
            description="Play a sound whenever a tracked pull request changes on refresh."
          >
            <Switch
              id="pr-sound"
              checked={soundOnPrUpdates}
              onCheckedChange={(checked) => setSoundOnPrUpdates(Boolean(checked))}
            />
          </SettingRow>
          <div className="py-3">
            <Label className="text-sm font-medium">Notification sound</Label>
            <p className="mt-0.5 text-xs text-muted-foreground mb-2">
              Choose a macOS system sound to play on PR updates.
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={notificationSound}
                onValueChange={(v) => setNotificationSound(v as MacOsNotificationSound)}
                disabled={!soundOnPrUpdates}
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MACOS_NOTIFICATION_SOUNDS.map((sound) => (
                    <SelectItem key={sound} value={sound}>
                      {sound}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={!soundOnPrUpdates || isTesting}
                onClick={handleTestSound}
                className="gap-1.5"
              >
                <Volume2 className="h-3.5 w-3.5" />
                {isTesting ? 'Playing…' : 'Test'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader
            icon={RefreshCw}
            title="Sync"
            description="Configure and monitor the background GitHub refresh loop."
          />
        </CardHeader>
        <CardContent className="pt-0 space-y-0">
          <Separator />
          <div className="py-3">
            <Label htmlFor="refresh-interval" className="text-sm font-medium">
              Refresh interval
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground mb-2">
              How often to sync repositories and pull requests (minimum 15 s).
            </p>
            <div className="flex items-center gap-2">
              <Input
                id="refresh-interval"
                type="number"
                min={15}
                max={3600}
                value={refreshIntervalSeconds}
                onChange={(event) => setRefreshIntervalSeconds(event.target.value)}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">seconds</span>
            </div>
          </div>
          <Separator />
          <div className="pt-3 pb-1 space-y-0.5">
            <StatusRow
              label="Last successful refresh"
              value={formatStatusTimestamp(snapshot.sync.lastRefreshedAt)}
            />
            <StatusRow
              label="Last detected PR update"
              value={formatStatusTimestamp(snapshot.sync.lastUpdateDetectedAt)}
            />
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">Background refresh</span>
              {snapshot.sync.isRefreshing ? (
                <span className="flex items-center gap-1.5 text-blue-500 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running
                </span>
              ) : (
                <span className="text-muted-foreground font-medium">Idle</span>
              )}
            </div>
          </div>
          {snapshot.sync.lastError && (
            <>
              <Separator />
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {snapshot.sync.lastError}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Accounts */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader
            icon={Users}
            title="Accounts"
            description="GitHub accounts authenticated via the gh CLI."
          />
        </CardHeader>
        <CardContent className="pt-0">
          <Separator />
          {accounts.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground text-center">No accounts found.</p>
          ) : (
            <div className="divide-y">
              {accounts.map((account) => (
                <div
                  key={`${account.hostname}/${account.login}`}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      {account.isActive ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{account.login}</p>
                      <p className="text-xs text-muted-foreground truncate">{account.hostname}</p>
                    </div>
                    {account.isActive && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                  {!account.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={switchingLogin !== null}
                      onClick={() => handleSwitchAccount(account.login)}
                      className="ml-3 shrink-0"
                    >
                      {switchingLogin === account.login ? 'Switching…' : 'Switch'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end pb-2">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

function formatStatusTimestamp(value: number | null): string {
  if (!value) {
    return 'Never'
  }

  return formatDistanceToNow(value, { addSuffix: true })
}
