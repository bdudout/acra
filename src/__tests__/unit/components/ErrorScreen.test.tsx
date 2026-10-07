import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ErrorScreen from '@/components/ErrorScreen'

describe('ErrorScreen', () => {
  it('affiche une page 404 ACRA avec le logo et un retour sûr', () => {
    render(<ErrorScreen kind="notFound" onRetry={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'ACRA' })).toHaveAttribute('src', '/logo-mark.png')
    expect(screen.getByText('404')).toBeInTheDocument()
    const home = screen.getByRole('link')
    expect(home).toHaveAttribute('href', '/')
    expect(home).toHaveClass('bg-white!', 'text-slate-950!')
  })

  it('propose de réessayer après une erreur applicative', () => {
    const retry = vi.fn()
    render(<ErrorScreen kind="error" onRetry={retry} />)
    fireEvent.click(screen.getByRole('button'))
    expect(retry).toHaveBeenCalledOnce()
  })
})
