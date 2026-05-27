'use client'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/firebase/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { AppUser } from '@/lib/types'

interface TopbarProps {
  user: AppUser
  nucleoName?: string
}

export function Topbar({ user, nucleoName }: TopbarProps) {
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <header className="h-12 bg-slate-900 flex items-center px-4 gap-4 flex-shrink-0">
      <span className="text-white font-bold text-sm">TurniChiari</span>
      <span className="text-slate-600 text-sm">|</span>
      {user.role === 'coordinatrice' ? (
        <div data-testid="nucleo-selector" className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
            Tutti i nuclei ▾
          </Button>
        </div>
      ) : (
        <span className="text-slate-400 text-xs">{nucleoName ?? 'Nucleo B'}</span>
      )}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-slate-400 text-xs">{user.name}</span>
        <Avatar className="h-7 w-7 cursor-pointer" onClick={handleSignOut}>
          <AvatarFallback className="bg-slate-700 text-white text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
