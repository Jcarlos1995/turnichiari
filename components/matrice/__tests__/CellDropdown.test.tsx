import { render, screen, fireEvent } from '@testing-library/react'
import { CellDropdown } from '../CellDropdown'
import type { ShiftType } from '@/lib/types'

const shiftTypes: ShiftType[] = [
  { code: 'M1', label: 'Mattina 1', startTime: '06:30', endTime: '13:30', color: '#fef3c7', operatorsPerDay: 2, isPartTime: false, isSystem: false },
  { code: 'N1', label: 'Notte 1', startTime: '21:00', endTime: '00:00', color: '#dbeafe', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'N2', label: 'Notte 2', startTime: '00:00', endTime: '06:30', color: '#bfdbfe', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'R', label: 'Riposo', startTime: '', endTime: '', color: '#f1f5f9', operatorsPerDay: 0, isPartTime: false, isSystem: true },
]

function setup(props: Partial<React.ComponentProps<typeof CellDropdown>> = {}) {
  const onSelect = jest.fn()
  const onSelectNight = jest.fn()
  const onClose = jest.fn()
  render(
    <CellDropdown
      currentCode={undefined}
      shiftTypes={shiftTypes}
      violations={{}}
      onSelect={onSelect}
      onSelectNight={onSelectNight}
      onClose={onClose}
      {...props}
    />
  )
  return { onSelect, onSelectNight, onClose }
}

describe('CellDropdown night option', () => {
  it('shows a single "Notte" option and hides N1/N2 buttons', () => {
    setup()
    expect(screen.getByText('Notte')).toBeInTheDocument()
    expect(screen.queryByText('N1')).not.toBeInTheDocument()
    expect(screen.queryByText('N2')).not.toBeInTheDocument()
  })

  it('calls onSelectNight(false) when current cell is empty', () => {
    const { onSelectNight } = setup({ currentCode: undefined })
    fireEvent.click(screen.getByText('Notte'))
    expect(onSelectNight).toHaveBeenCalledWith(false)
  })

  it('calls onSelectNight(true) when overwriting an existing shift', () => {
    const { onSelectNight } = setup({ currentCode: 'M1' })
    fireEvent.click(screen.getByText('Notte'))
    expect(onSelectNight).toHaveBeenCalledWith(true)
  })

  it('does not call onSelectNight when the night option is blocked by a violation', () => {
    const { onSelectNight } = setup({
      violations: { N1: [{ rule: 'MIN_REST_11H', message: 'x', hoursAvailable: 5, hoursRequired: 11 }] },
    })
    fireEvent.click(screen.getByText('Notte'))
    expect(onSelectNight).not.toHaveBeenCalled()
  })
})
