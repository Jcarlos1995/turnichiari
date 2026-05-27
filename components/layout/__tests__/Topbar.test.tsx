import { render, screen } from '@testing-library/react'
import { Topbar } from '../Topbar'
import type { AppUser } from '@/lib/types'

const raaUser: AppUser = {
  uid: '1', email: 'raa@sgb.it', name: 'Maria Rossi',
  role: 'raa', nucleoId: 'nucleo-b'
}

const coordinatriceUser: AppUser = {
  uid: '2', email: 'coord@sgb.it', name: 'Anna Bianchi',
  role: 'coordinatrice', nucleoId: null
}

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/firebase/auth', () => ({ signOut: jest.fn() }))

describe('Topbar', () => {
  it('shows TurniChiari brand', () => {
    render(<Topbar user={raaUser} />)
    expect(screen.getByText('TurniChiari')).toBeInTheDocument()
  })

  it('shows nucleo selector for coordinatrice', () => {
    render(<Topbar user={coordinatriceUser} />)
    expect(screen.getByTestId('nucleo-selector')).toBeInTheDocument()
  })

  it('does not show nucleo selector for RAA', () => {
    render(<Topbar user={raaUser} />)
    expect(screen.queryByTestId('nucleo-selector')).not.toBeInTheDocument()
  })
})
