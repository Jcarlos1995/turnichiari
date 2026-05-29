import { render, screen, fireEvent } from '@testing-library/react'
import { MatriceCell } from '../MatriceCell'
import type { ShiftType } from '@/lib/types'

const M1: ShiftType = { code: 'M1', label: 'Mattina 1', startTime: '06:30', endTime: '13:30', color: '#fef3c7', operatorsPerDay: 2, isPartTime: false, isSystem: false }

describe('MatriceCell', () => {
  it('renders shift code', () => {
    render(<MatriceCell entry={{ code: 'M1' }} shiftType={M1} editable={false} onSelect={jest.fn()} />)
    expect(screen.getByText('M1')).toBeInTheDocument()
  })

  it('does not open dropdown when not editable', () => {
    render(<MatriceCell entry={{ code: 'M1' }} shiftType={M1} editable={false} onSelect={jest.fn()} />)
    fireEvent.click(screen.getByText('M1'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('applies shift background color', () => {
    const { container } = render(<MatriceCell entry={{ code: 'M1' }} shiftType={M1} editable={true} onSelect={jest.fn()} />)
    const cell = container.firstChild as HTMLElement
    expect(cell.style.backgroundColor).toBe('rgb(254, 243, 199)')
  })
})

describe('MatriceCell smonto (N2) read-only', () => {
  const n2Shift: ShiftType = {
    code: 'N2', label: 'Notte 2', startTime: '00:00', endTime: '06:30',
    color: '#bfdbfe', operatorsPerDay: 1, isPartTime: false, isSystem: false,
  }

  it('does not open the dropdown when an N2 cell is clicked', () => {
    render(
      <MatriceCell
        entry={{ code: 'N2', updatedAt: 1 }}
        shiftType={n2Shift}
        editable={true}
        onSelect={jest.fn()}
        onSelectNight={jest.fn()}
        allShiftTypes={[n2Shift]}
      />
    )
    fireEvent.click(screen.getByText('N2'))
    // The dropdown renders an "Assenze" section; assert it did NOT appear
    expect(screen.queryByText('Assenze')).not.toBeInTheDocument()
  })
})
