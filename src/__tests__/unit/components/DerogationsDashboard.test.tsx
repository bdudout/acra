import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DerogationsDashboard from '@/components/DerogationsDashboard'

describe('DerogationsDashboard', () => {
  it('affiche les quatre indicateurs de suivi', () => {
    render(<DerogationsDashboard dashboard={{ active: 2, expiringSoon: 1, expired: 3, pending: 4, total: 10 }} labels={{ active: 'En cours', expiringSoon: 'À échéance', expired: 'Expirées', pending: 'En revue', title: 'Suivi' }} />)
    expect(screen.getByText('Suivi')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('À échéance')).toBeInTheDocument()
  })
})
