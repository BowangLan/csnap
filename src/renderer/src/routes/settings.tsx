import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { Button } from '@renderer/components/ui/button'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  const snapshot = useGithubSnapshot()
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(
    String(snapshot.settings.refreshIntervalSeconds),
  )
  const [soundOnPrUpdates, setSoundOnPrUpdates] = useState(snapshot.settings.soundOnPrUpdates)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setRefreshIntervalSeconds(String(snapshot.settings.refreshIntervalSeconds))
    setSoundOnPrUpdates(snapshot.settings.soundOnPrUpdates)
  }, [snapshot.settings.refreshIntervalSeconds, snapshot.settings.soundOnPrUpdates])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await window.api.github.updateSettings({
        refreshIntervalSeconds: Number(refreshIntervalSeconds),
        soundOnPrUpdates,
      })
      toast.success('GitHub sync settings updated.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>GitHub Sync</CardTitle>
          <CardDescription>Configure background refresh and pull request notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refresh-interval">Refresh interval (seconds)</Label>
            <Input
              id="refresh-interval"
              type="number"
              min={15}
              max={3600}
              value={refreshIntervalSeconds}
              onChange={(event) => setRefreshIntervalSeconds(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The sync loop refreshes repositories and pull requests every 60 seconds by default.
            </p>
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="pr-sound" className="flex flex-col space-y-1">
              <span>Sound on pull request updates</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Play a system sound whenever a tracked pull request changes on refresh.
              </span>
            </Label>
            <Switch
              id="pr-sound"
              checked={soundOnPrUpdates}
              onCheckedChange={(checked) => setSoundOnPrUpdates(Boolean(checked))}
            />
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label className="flex flex-col space-y-1">
              <span>Authenticated account</span>
              <span className="font-normal leading-snug text-muted-foreground">
                {snapshot.auth.isAuthenticated
                  ? snapshot.auth.activeLogin
                  : 'GitHub CLI is not authenticated'}
              </span>
            </Label>
            <span className="text-sm text-muted-foreground">
              {snapshot.auth.isAuthenticated ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync Status</CardTitle>
          <CardDescription>Current state of the background GitHub refresh loop.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last successful refresh</span>
            <span>{formatStatusTimestamp(snapshot.sync.lastRefreshedAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last detected PR update</span>
            <span>{formatStatusTimestamp(snapshot.sync.lastUpdateDetectedAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Background refresh</span>
            <span>{snapshot.sync.isRefreshing ? 'Running' : 'Idle'}</span>
          </div>
          {snapshot.sync.lastError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              {snapshot.sync.lastError}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function formatStatusTimestamp(value: number | null): string {
  if (!value) {
    return 'Never'
  }

  return formatDistanceToNow(value, { addSuffix: true })
}
