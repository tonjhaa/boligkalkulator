import { useState } from 'react'
import { Link2, Link2Off, Mail, Copy, Check, Clock, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePartnershipStore } from '@/store/usePartnershipStore'
import { buildMailtoLink } from '@/lib/partnerSync'
import { cn } from '@/lib/utils'

export function PartnerLinkSection() {
  const { partnership, status, inviteLink, loading, error, invite, disconnect, clearError } =
    usePartnershipStore()

  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    clearError()
    await invite(email.trim())
    setEmail('')
  }

  function handleCopy() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ---- Koblet ----
  if (status === 'connected' && partnership) {
    const partnerEmail = partnership.invitee_email
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
          <UserCheck className="h-4 w-4 text-green-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-green-400">Koblet til partner</p>
            <p className="text-xs text-muted-foreground truncate">{partnerEmail}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Partnerens økonomidata synkroniseres sanntid og vises i Partner-fanen.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-red-400 hover:text-red-300 hover:border-red-400/50"
          onClick={() => disconnect()}
          disabled={loading}
        >
          <Link2Off className="h-3.5 w-3.5 mr-1.5" />
          Koble fra partner
        </Button>
      </div>
    )
  }

  // ---- Venter på aksept ----
  if (status === 'pending_sent' && partnership && inviteLink) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <Clock className="h-4 w-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-amber-400">Venter på aksept</p>
            <p className="text-xs text-muted-foreground truncate">{partnership.invitee_email}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Del denne lenken med partneren din</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={inviteLink}
              className="text-xs font-mono bg-muted/30"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
              {copied
                ? <Check className="h-3.5 w-3.5 text-green-400" />
                : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <a
          href={buildMailtoLink(partnership.invitee_email, inviteLink)}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border',
            'hover:bg-muted/20 transition-colors',
          )}
        >
          <Mail className="h-3.5 w-3.5" />
          Åpne i e-postklient
        </a>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => disconnect()}
          disabled={loading}
        >
          Avbryt invitasjon
        </Button>
      </div>
    )
  }

  // ---- Mottatt invitasjon ----
  if (status === 'pending_received' && partnership) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-3">
          <Link2 className="h-4 w-4 text-violet-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-violet-400">Du har fått en invitasjon</p>
            <p className="text-xs text-muted-foreground">Fra en bruker i Lommeboka</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Aksepter for å dele økonomidata og se hverandres tall i sanntid.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="text-xs"
            onClick={() => usePartnershipStore.getState().accept(partnership.id)}
            disabled={loading}
          >
            <UserCheck className="h-3.5 w-3.5 mr-1.5" />
            Aksepter
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => disconnect()}
            disabled={loading}
          >
            Avvis
          </Button>
        </div>
      </div>
    )
  }

  // ---- Ikke koblet — inviter ----
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Inviter partneren din til Lommeboka. Når hun aksepterer, kan dere se
        hverandres økonomidata i sanntid.
      </p>

      <form onSubmit={handleInvite} className="space-y-2">
        <Label className="text-xs">Partnerens e-postadresse</Label>
        <div className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ane@eksempel.no"
            className="text-xs"
            disabled={loading}
          />
          <Button type="submit" size="sm" disabled={loading || !email.trim()} className="shrink-0">
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Send
          </Button>
        </div>
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </form>
    </div>
  )
}
