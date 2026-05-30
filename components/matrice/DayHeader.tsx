interface DayHeaderProps {
  day: number
  date: Date
  isToday: boolean
  isColHovered?: boolean
}

const DAY_NAMES = ['D', 'L', 'M', 'Me', 'G', 'V', 'S']

export function DayHeader({ day, date, isToday, isColHovered = false }: DayHeaderProps) {
  const dayName = DAY_NAMES[date.getDay()]
  const isWeekend = date.getDay() === 0 || date.getDay() === 6

  return (
    <div className={`flex flex-col items-center justify-center h-9 rounded text-xs font-semibold select-none transition-colors
      ${isToday ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-400' :
        isColHovered ? 'bg-blue-100 text-blue-700' :
        isWeekend ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
      <span>{dayName}</span>
      <span>{day}</span>
    </div>
  )
}
