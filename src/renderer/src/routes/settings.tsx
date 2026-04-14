import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { FolderOpen, GitBranch, X } from 'lucide-react'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import type { GithubRepository } from '../../../shared/github'

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

      <LocalRepositoriesCard
        repositories={snapshot.repositories}
        localRepoPaths={snapshot.settings.localRepoPaths}
      />
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
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Local Repositories</CardTitle>
        </div>
        <CardDescription>
          Link tracked repos to local folders so you can check out branches directly from the PR list.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Separator className="mb-0" />
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

function formatStatusTimestamp(value: number | null): string {
  if (!value) {
    return 'Never'
  }

  return formatDistanceToNow(value, { addSuffix: true })
}
