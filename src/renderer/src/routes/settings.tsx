import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  Bell,
  RefreshCw,
  Loader2,
  Volume2,
  FolderOpen,
  GitBranch,
  X,
} from 'lucide-react'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Card, CardContent, CardHeader } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import {
  DEFAULT_EVENT_SOUNDS,
  MACOS_NOTIFICATION_SOUNDS,
  type EventSoundConfig,
  type LocalCommandLog,
  type GithubRepository,
  type GithubSettings,
  type MacOsNotificationSound,
  type PrNotificationEvent,
} from '../../../shared/github'

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

function EventSoundRow({
  label,
  description,
  config,
  onChange,
  onTestSound,
  onTestNotification,
}: {
  label: string
  description: string
  config: EventSoundConfig
  onChange: (next: EventSoundConfig) => void
  onTestSound: (sound: MacOsNotificationSound) => void
  onTestNotification: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => onChange({ ...config, enabled: Boolean(checked) })}
        />
        <Select
          value={config.sound}
          onValueChange={(v) => onChange({ ...config, sound: v as MacOsNotificationSound })}
          disabled={!config.enabled}
        >
          <SelectTrigger size="sm" className="w-32">
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
          disabled={!config.enabled}
          onClick={() => onTestSound(config.sound)}
          className="gap-1"
          title="Test sound"
        >
          <Volume2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onTestNotification}
          className="gap-1"
          title="Send test notification"
        >
          <Bell className="h-3.5 w-3.5" />
        </Button>
      </div>
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
  const [eventSounds, setEventSounds] = useState<GithubSettings['eventSounds']>(
    snapshot.settings.eventSounds ?? DEFAULT_EVENT_SOUNDS,
  )
  const [nativeNotifications, setNativeNotifications] = useState(
    snapshot.settings.nativeNotifications,
  )
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setRefreshIntervalSeconds(String(snapshot.settings.refreshIntervalSeconds))
    setSoundOnPrUpdates(snapshot.settings.soundOnPrUpdates)
    setNotificationSound(snapshot.settings.notificationSound)
    setEventSounds(snapshot.settings.eventSounds ?? DEFAULT_EVENT_SOUNDS)
    setNativeNotifications(snapshot.settings.nativeNotifications)
  }, [
    snapshot.settings.refreshIntervalSeconds,
    snapshot.settings.soundOnPrUpdates,
    snapshot.settings.notificationSound,
    snapshot.settings.eventSounds,
    snapshot.settings.nativeNotifications,
  ])

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

  const handleTestEventSound = (sound: MacOsNotificationSound) => {
    window.api.github.playSound(sound).catch(() => toast.error('Failed to play sound.'))
  }

  const handleTestNotification = (event: PrNotificationEvent) => {
    console.log('[handleTestNotification] sending event:', event)
    window.api.github.sendTestNotification(event)
      .then(() => console.log('[handleTestNotification] IPC resolved'))
      .catch((err) => {
        console.error('[handleTestNotification] IPC error:', err)
        toast.error('Failed to send notification.')
      })
  }

  const updateEventSound = (key: keyof GithubSettings['eventSounds'], next: EventSoundConfig) => {
    setEventSounds((prev) => ({ ...prev, [key]: next }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await window.api.github.updateSettings({
        refreshIntervalSeconds: Number(refreshIntervalSeconds),
        soundOnPrUpdates,
        notificationSound,
        eventSounds,
        nativeNotifications,
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
            label="Native OS notifications"
            description="Show a system notification for each PR event: new commits, CI results, and status changes."
          >
            <Switch
              id="native-notifications"
              checked={nativeNotifications}
              onCheckedChange={(checked) => setNativeNotifications(Boolean(checked))}
            />
          </SettingRow>
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
          <Separator />
          <div className="py-3">
            <p className="text-sm font-medium">Event-specific sounds</p>
            <p className="mt-0.5 text-xs text-muted-foreground mb-3">
              Play different sounds for specific PR and CI events. Takes priority over the generic sound above.
            </p>
            <div className="divide-y">
              <EventSoundRow
                label="New commit"
                description="A new commit was pushed to the PR branch."
                config={eventSounds.newCommit}
                onChange={(next) => updateEventSound('newCommit', next)}
                onTestSound={handleTestEventSound}
                onTestNotification={() => handleTestNotification('newCommit')}
              />
              <EventSoundRow
                label="CI check completed"
                description="An individual CI check finished running."
                config={eventSounds.ciCheckComplete}
                onChange={(next) => updateEventSound('ciCheckComplete', next)}
                onTestSound={handleTestEventSound}
                onTestNotification={() => handleTestNotification('ciCheckCompleted')}
              />
              <EventSoundRow
                label="All CI passed"
                description="All CI checks completed and the overall status is passing."
                config={eventSounds.allCiPassed}
                onChange={(next) => updateEventSound('allCiPassed', next)}
                onTestSound={handleTestEventSound}
                onTestNotification={() => handleTestNotification('allCiPassed')}
              />
              <EventSoundRow
                label="All CI failed"
                description="All CI checks completed and the overall status is failing."
                config={eventSounds.allCiFailed}
                onChange={(next) => updateEventSound('allCiFailed', next)}
                onTestSound={handleTestEventSound}
                onTestNotification={() => handleTestNotification('allCiFailed')}
              />
              <EventSoundRow
                label="PR approved"
                description="A reviewer approved the pull request."
                config={eventSounds.prApproved}
                onChange={(next) => updateEventSound('prApproved', next)}
                onTestSound={handleTestEventSound}
                onTestNotification={() => handleTestNotification('prApproved')}
              />
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

      {/* Local Repositories */}
      <LocalRepositoriesCard repositories={snapshot.repositories} localRepoPaths={snapshot.settings.localRepoPaths} />
      <RecentCommandsCard commandLogs={snapshot.commandLogs} />

      <div className="flex justify-end pb-2">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

function LocalRepositoriesCard({
  repositories,
  localRepoPaths,
}: {
  repositories: GithubRepository[]
  localRepoPaths: Record<string, string>
}) {
  const [paths, setPaths] = useState<Record<string, string>>(localRepoPaths)

  // Keep in sync if snapshot changes externally
  useEffect(() => {
    setPaths(localRepoPaths)
  }, [localRepoPaths])

  const handlePickFolder = async (nameWithOwner: string) => {
    const picked = await window.api.github.pickFolder()
    if (picked === null) return
    setPaths((prev) => ({ ...prev, [nameWithOwner]: picked }))
    try {
      await window.api.github.setRepoPath(nameWithOwner, picked)
      toast.success(`Linked ${nameWithOwner.split('/')[1]} to local folder`)
    } catch {
      toast.error('Failed to save local path')
    }
  }

  const handleClear = async (nameWithOwner: string) => {
    setPaths((prev) => {
      const next = { ...prev }
      delete next[nameWithOwner]
      return next
    })
    try {
      await window.api.github.setRepoPath(nameWithOwner, '')
    } catch {
      toast.error('Failed to clear local path')
    }
  }

  if (repositories.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={GitBranch}
          title="Local Repositories"
          description="Link tracked repos to local folders so you can check out branches directly from the PR list."
        />
      </CardHeader>
      <CardContent className="pt-0">
        <Separator />
        <div className="divide-y">
          {repositories.map((repo) => {
            const localPath = paths[repo.nameWithOwner] ?? ''
            return (
              <div key={repo.nameWithOwner} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{repo.nameWithOwner}</p>
                  {localPath ? (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{localPath}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 mt-0.5 italic">No local path set</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePickFolder(repo.nameWithOwner)}
                    className="gap-1.5"
                    title="Choose folder"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {localPath ? 'Change' : 'Set folder'}
                  </Button>
                  {localPath && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleClear(repo.nameWithOwner)}
                      title="Clear local path"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function RecentCommandsCard({ commandLogs }: { commandLogs: LocalCommandLog[] }) {
  const localLogs = commandLogs.filter((log) => log.scope === 'local').slice(0, 8)

  if (localLogs.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={GitBranch}
          title="Recent Local Commands"
          description="Latest local git command output, including commands triggered from the PR list."
        />
      </CardHeader>
      <CardContent className="pt-0">
        <Separator />
        <div className="divide-y">
          {localLogs.map((log) => (
            <div key={log.id} className="space-y-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {log.command} {log.args.join(' ')}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{log.cwd}</p>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    log.status === 'failed'
                      ? 'text-destructive'
                      : log.status === 'succeeded'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                  }`}
                >
                  {log.status === 'running'
                    ? 'Running'
                    : log.status === 'succeeded'
                      ? 'Succeeded'
                      : 'Failed'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatStatusTimestamp(log.finishedAt ?? log.startedAt)}
              </p>
              {log.output ? (
                <pre className="overflow-x-auto rounded-md border bg-muted/40 p-2 text-xs whitespace-pre-wrap break-words">
                  {log.output}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function formatStatusTimestamp(value: number | null): string {
  if (!value) {
    return 'Never'
  }

  return formatDistanceToNow(value, { addSuffix: true })
}
