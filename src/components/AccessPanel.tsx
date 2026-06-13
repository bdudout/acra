'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import {
  ROLE_LABELS, ROLE_COLORS, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS,
  STATUT_APPROBATION_LABELS,
  type UserRole, type AnalysePermission,
} from '@/lib/permissions'

interface AccessEntry {
  id: string
  userId: string
  permission: AnalysePermission
  user: { id: string; name: string | null; email: string; role: UserRole }
}

interface Props {
  analyseId: string
  statut: string
  ownerId: string
  ownerName?: string | null
  ownerEmail?: string
  currentUserId: string
  currentUserRole: UserRole
  canManage: boolean   // peut inviter/retirer
  canSubmit: boolean   // peut soumettre
  canApprove: boolean  // peut approuver/rejeter
  commentaireApprobation?: string | null
  approuveLe?: string | null
  approbateurId?: string | null
  onStatutChange?: (newStatut: string) => void
}

export default function AccessPanel({
  analyseId, statut: statutInit, ownerId, ownerName, ownerEmail,
  currentUserId, currentUserRole,
  canManage, canSubmit, canApprove,
  commentaireApprobation: commentaireInit, approuveLe, approbateurId,
  onStatutChange,
}: Props) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [statut, setStatut] = useState(statutInit)
  const [commentaireApprobation, setCommentaireApprobation] = useState(commentaireInit ?? null)
  const [accès, setAccès] = useState<AccessEntry[]>([])
  const [loadingAccès, setLoadingAccès] = useState(false)

  // Formulaire d'invitation
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePerm, setInvitePerm] = useState<AnalysePermission>('LECTURE')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Workflow approbation
  const [commentaire, setCommentaire] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)

  useEffect(() => {
    if (!canManage) return
    setLoadingAccès(true)
    fetch(`/api/analyses/${analyseId}/access`)
      .then(r => r.json())
      .then(d => { setAccès(Array.isArray(d) ? d : []); setLoadingAccès(false) })
      .catch(() => setLoadingAccès(false))
  }, [analyseId, canManage])

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)
    try {
      const res = await fetch(`/api/analyses/${analyseId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), permission: invitePerm }),
      })
      const data = await res.json()
      if (!res.ok) { setInviteError(data.error); return }
      setAccès(prev => {
        const exists = prev.find(a => a.userId === data.userId)
        return exists ? prev.map(a => a.userId === data.userId ? data : a) : [...prev, data]
      })
      setInviteSuccess(`${inviteEmail} ${t.access.inviteSuccessSuffix}`)
      setInviteEmail('')
      setTimeout(() => setInviteSuccess(null), 3000)
    } catch { setInviteError(t.networkError) } finally { setInviting(false) }
  }

  async function handleRemove(targetUserId: string) {
    try {
      await fetch(`/api/analyses/${analyseId}/access?targetUserId=${targetUserId}`, { method: 'DELETE' })
      setAccès(prev => prev.filter(a => a.userId !== targetUserId))
    } catch { /* silent */ }
  }

  async function handleApprobation(action: 'SOUMETTRE' | 'APPROUVER' | 'REJETER') {
    if (action === 'REJETER' && !commentaire.trim()) {
      setApprovalError(t.access.rejectRequired)
      return
    }
    setSubmitting(true)
    setApprovalError(null)
    try {
      const res = await fetch(`/api/analyses/${analyseId}/approbation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, commentaire: commentaire || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setApprovalError(data.error); return }
      // Mise à jour locale immédiate pour un feedback rapide
      setStatut(data.statut)
      if (data.commentaireApprobation !== undefined) setCommentaireApprobation(data.commentaireApprobation)
      setCommentaire('')
      onStatutChange?.(data.statut)
      // Rafraîchir les données serveur (header statut, etc.)
      router.refresh()
    } catch { setApprovalError(t.networkError) } finally { setSubmitting(false) }
  }

  const statutInfo = STATUT_APPROBATION_LABELS[statut] ?? STATUT_APPROBATION_LABELS.EN_COURS

  return (
    <div className="space-y-6">

      {/* Statut d'approbation */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 mb-3">📋 {t.access.statusTitle}</h3>
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${statutInfo.color}`}>
            {statutInfo.icon} {statutInfo.label}
          </span>
          {approuveLe && (
            <span className="text-xs text-gray-500">
              {formatDate(approuveLe, locale)}
            </span>
          )}
        </div>

        {commentaireApprobation && (
          <div className={`p-3 rounded-lg text-sm mb-4 ${statut === 'REJETE' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
            <div className="font-medium mb-1">{t.access.commentRM}</div>
            {commentaireApprobation}
          </div>
        )}

        {/* Actions analyste : soumettre */}
        {canSubmit && (statut === 'EN_COURS' || statut === 'REJETE') && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600 mb-3">
              {statut === 'REJETE' ? t.access.submitRejected : t.access.submitHint}
            </p>
            <button
              onClick={() => handleApprobation('SOUMETTRE')}
              disabled={submitting}
              className="btn-primary disabled:opacity-50"
            >
              {submitting ? t.access.submitting : t.access.submitBtn}
            </button>
          </div>
        )}

        {/* Actions Risk Manager : approuver / rejeter */}
        {canApprove && statut === 'SOUMIS' && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-sm text-gray-600">{t.access.approveHint}</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t.access.commentLabel}</label>
              <textarea
                value={commentaire}
                onChange={e => setCommentaire(e.target.value)}
                rows={2}
                placeholder={t.access.commentPh}
                className="input w-full text-sm"
              />
            </div>
            {approvalError && (
              <p className="text-sm text-red-600">⚠️ {approvalError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleApprobation('APPROUVER')}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {t.access.approveBtn}
              </button>
              <button
                onClick={() => handleApprobation('REJETER')}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {t.access.rejectBtn}
              </button>
            </div>
          </div>
        )}

        {/* Analyse soumise — en attente (vue analyste) */}
        {canSubmit && statut === 'SOUMIS' && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-blue-700 bg-blue-50 p-3 rounded-lg">
              {t.access.pendingMsg}
            </p>
          </div>
        )}

        {/* Analyse approuvée */}
        {statut === 'APPROUVE' && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
              {t.access.approvedMsg}
            </p>
          </div>
        )}
      </div>

      {/* Gestion des accès */}
      {canManage && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">👥 {t.access.collaboTitle}</h3>

          {/* Propriétaire */}
          <div className="flex items-center gap-3 p-3 bg-ebios-50 rounded-lg border border-ebios-100 mb-3">
            <div className="w-8 h-8 rounded-full bg-ebios-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {(ownerName ?? ownerEmail ?? '?')[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800">
                {ownerName || ownerEmail}
                {ownerId === currentUserId && <span className="ml-2 text-xs text-ebios-600">{t.access.youLabel}</span>}
              </div>
              <div className="text-xs text-gray-500">{ownerEmail}</div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-ebios-100 text-ebios-700 font-medium">
              {t.access.ownerLabel}
            </span>
          </div>

          {/* Liste des accès */}
          {loadingAccès ? (
            <div className="text-sm text-gray-500 italic py-2">{t.access.loading}</div>
          ) : (
            <div className="space-y-2 mb-4">
              {accès.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {(a.user.name ?? a.user.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{a.user.name || a.user.email}</div>
                    <div className="text-xs text-gray-500 truncate">{a.user.email}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLORS[a.user.role]}`}>
                    {ROLE_LABELS[a.user.role]}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {PERMISSION_LABELS[a.permission]}
                  </span>
                  <button
                    onClick={() => handleRemove(a.userId)}
                    className="text-gray-500 hover:text-red-500 transition-colors flex-shrink-0 ml-1"
                    title={t.access.removeTitle}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {accès.length === 0 && (
                <p className="text-sm text-gray-500 italic py-2">{t.access.noCollabo}</p>
              )}
            </div>
          )}

          {/* Formulaire d'invitation */}
          <div className="border-t border-gray-100 pt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">{t.access.inviteTitle}</div>
            <div className="flex gap-2 flex-wrap">
              <input
                type="email"
                placeholder={t.access.inviteEmailPh}
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                className="input flex-1 min-w-0 text-sm"
              />
              <select
                value={invitePerm}
                onChange={e => setInvitePerm(e.target.value as AnalysePermission)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white focus:ring-2 focus:ring-ebios-500"
                title={PERMISSION_DESCRIPTIONS[invitePerm]}
              >
                {(['LECTURE', 'EDITION', 'APPROBATION'] as AnalysePermission[]).map(p => (
                  <option key={p} value={p}>{PERMISSION_LABELS[p]}</option>
                ))}
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="btn-primary text-sm disabled:opacity-50 flex-shrink-0"
              >
                {inviting ? t.access.inviting : t.access.inviteBtn}
              </button>
            </div>
            {inviteError && <p className="text-sm text-red-600 mt-2">⚠️ {inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-600 mt-2">✅ {inviteSuccess}</p>}
            <div className="mt-2 grid grid-cols-1 gap-1">
              {(['LECTURE', 'EDITION', 'APPROBATION'] as AnalysePermission[]).map(p => (
                <div key={p} className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">{PERMISSION_LABELS[p]}</span> — {PERMISSION_DESCRIPTIONS[p]}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
