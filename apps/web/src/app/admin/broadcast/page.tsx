'use client';

import { useState } from 'react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Megaphone, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Pre-filled with the MCP v0.5.0 security advisory so it's one click.
// Clear/edit for other announcements. dedupeKey makes re-sends safe —
// re-running with the same key skips wallets that already got it.
const ADVISORY_PRESET = {
  title: 'Security update — upgrade PNL MCP to 0.5.0',
  message:
    'A security fix shipped for the PNL MCP server. Upgrade now: npm i -g @pnlmarket/mcp-server@latest, then restart your agent. It fixes a bug where pnl_restore could write your recovery phrase into your agent chat history. If you restored a wallet on an older version, consider moving funds to a fresh wallet. Details: github.com/aitankfish/pnl/releases/tag/mcp-v0.5.0',
  priority: 'high',
  actionUrl: 'https://github.com/aitankfish/pnl/releases/tag/mcp-v0.5.0',
  dedupeKey: 'mcp-v0.5.0-security',
};

interface BroadcastResult {
  success: boolean;
  total?: number;
  sent?: number;
  skipped?: number;
  dedupeKey?: string;
  error?: string;
}

export default function BroadcastAdminPage() {
  const { primaryWallet } = useWallet();

  const [title, setTitle] = useState(ADVISORY_PRESET.title);
  const [message, setMessage] = useState(ADVISORY_PRESET.message);
  const [priority, setPriority] = useState(ADVISORY_PRESET.priority);
  const [actionUrl, setActionUrl] = useState(ADVISORY_PRESET.actionUrl);
  const [dedupeKey, setDedupeKey] = useState(ADVISORY_PRESET.dedupeKey);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [confirmArmed, setConfirmArmed] = useState(false);

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await authFetch('/api/admin/broadcast-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, priority, actionUrl, dedupeKey }),
      });
      const json = (await res.json()) as BroadcastResult;
      setResult(json);
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
      setConfirmArmed(false);
    }
  };

  const msgTooLong = message.length > 1000;
  const titleTooLong = title.length > 255;
  const canSend =
    !sending && title.trim() && message.trim() && dedupeKey.trim() && !msgTooLong && !titleTooLong;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Megaphone className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Broadcast notification</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform-wide announcement</CardTitle>
          <CardDescription>
            Fans out one notification to every wallet with a profile. Admin-only —
            non-admins get a 403 from the server. Connected as{' '}
            <span className="font-mono text-xs">
              {primaryWallet?.address ?? 'not connected'}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Title <span className="text-muted-foreground">({title.length}/255)</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleTooLong}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">
              Message <span className="text-muted-foreground">({message.length}/1000)</span>
            </Label>
            <Textarea
              id="message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={msgTooLong}
            />
            {msgTooLong && (
              <p className="text-sm text-red-400">Message exceeds the 1000-char limit.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dedupeKey">Dedupe key</Label>
              <Input
                id="dedupeKey"
                value={dedupeKey}
                onChange={(e) => setDedupeKey(e.target.value)}
                placeholder="unique-per-announcement"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actionUrl">Action URL (optional)</Label>
            <Input id="actionUrl" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} />
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-muted-foreground">
                This sends to <strong>every existing user</strong>. Re-running with the same{' '}
                <code>dedupeKey</code> is safe — wallets that already received it are skipped.
              </p>
            </div>
          </div>

          {!confirmArmed ? (
            <Button onClick={() => setConfirmArmed(true)} disabled={!canSend} className="w-full">
              Review &amp; send
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmArmed(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={send} disabled={!canSend} className="flex-1">
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  'Confirm broadcast'
                )}
              </Button>
            </div>
          )}

          {result && (
            <div
              className={`rounded-md border p-3 text-sm ${
                result.success
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-red-500/30 bg-red-500/5'
              }`}
            >
              {result.success ? (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                  <p>
                    Sent to <strong>{result.sent}</strong> wallet(s),{' '}
                    <strong>{result.skipped}</strong> already had it, {result.total} total known.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p>{result.error || 'Broadcast failed.'}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
