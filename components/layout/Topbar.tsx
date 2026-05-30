'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { signOut } from '@/lib/firebase/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { AppUser } from '@/lib/types'

interface TopbarProps {
  user: AppUser
  nucleoName?: string
}

const NAV = [
  { href: '/matrice', label: 'Matrice' },
  { href: '/impostazioni/operatori', label: 'Operatori' },
  { href: '/impostazioni/cicli', label: 'Impostazioni' },
  { href: '/impostazioni/banca-ore', label: 'Banca ore' },
]

export function Topbar({ user, nucleoName }: TopbarProps) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  const initials = user.name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <header className="h-14 bg-slate-900 flex items-center px-4 gap-3 flex-shrink-0 shadow-sm">
      {/* Brand */}
      <Link href="/matrice" className="flex items-center gap-2 group">
        <span className="grid place-items-center h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[11px] font-bold shadow-sm">
          TC
        </span>
        <span className="text-white font-bold text-sm tracking-tight hidden sm:block group-hover:text-blue-200 transition-colors">
          TurniChiari
        </span>
      </Link>

      {/* Nucleo */}
      {user.role === 'coordinatrice' ? (
        <div data-testid="nucleo-selector" className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
            Tutti i nuclei ▾
          </Button>
        </div>
      ) : (
        <span className="bg-slate-800 text-slate-300 rounded-full px-2.5 py-1 text-[11px] font-medium border border-slate-700">
          {nucleoName ?? 'Nucleo B'}
        </span>
      )}

      {/* Nav */}
      {user.role !== 'oss' && (
        <nav className="ml-auto flex items-center gap-1">
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  active
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}

      {/* User */}
      <div className={`flex items-center gap-2 ${user.role !== 'oss' ? 'pl-3 ml-1 border-l border-slate-700' : 'ml-auto'}`}>
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-700 text-white text-[10px] font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-slate-300 text-xs hidden md:block max-w-[140px] truncate">{user.name}</span>
        <button
          onClick={handleSignOut}
          title="Esci"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg px-2 py-1.5 transition-colors"
        >
          <span aria-hidden>⏻</span>
          <span className="hidden sm:block">Esci</span>
        </button>
      </div>
    </header>
  )
}
