import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { Loading } from './components/ui'
import type { CharacterRecord } from './data/db'
import { useActiveCharacter } from './data/hooks'
import { EditCharacterPage, NewCharacterPage } from './features/characters/CharacterPages'
import { StartingSpellsPage } from './features/characters/StartingSpellsPage'
import { CustomSpellPage } from './features/library/CustomSpellPage'
import { LibraryPage } from './features/library/LibraryPage'
import { MySpellsPage } from './features/library/MySpellsPage'
import { LedgerPage } from './features/ledger/LedgerPage'
import { MorePage } from './features/more/MorePage'
import { PreparePage } from './features/prepare/PreparePage'
import { TodayPage } from './features/today/TodayPage'
import { BookPage } from './features/spellbook/BookPage'

/** Renders its child with the active character; without one, the Library is the place to go. */
function WithCharacter({ render }: { render: (c: CharacterRecord) => ReactNode }) {
  const c = useActiveCharacter()
  if (c === undefined) return <Loading />
  if (c === null) return <Navigate to="/library" replace />
  return <>{render(c)}</>
}

/** Renders its child with the active character, or with none (browsing). */
function MaybeCharacter({ render }: { render: (c: CharacterRecord | undefined) => ReactNode }) {
  const c = useActiveCharacter()
  if (c === undefined) return <Loading />
  return <>{render(c ?? undefined)}</>
}

/** Opens the book if there is a character, otherwise the Library. */
function Home() {
  const c = useActiveCharacter()
  if (c === undefined) return <Loading />
  return <Navigate to={c ? '/book' : '/library'} replace />
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<NewCharacterPage />} />
        <Route path="/setup/spells" element={<StartingSpellsPage />} />
        <Route path="/character" element={<EditCharacterPage />} />
        <Route path="/book" element={<WithCharacter render={(c) => <BookPage character={c} />} />} />
        <Route path="/library" element={<MaybeCharacter render={(c) => <LibraryPage key={c?.id ?? 'browse'} character={c} />} />} />
        <Route path="/library/custom" element={<CustomSpellPage />} />
        <Route path="/library/custom/:id" element={<CustomSpellPage />} />
        <Route path="/spells" element={<MySpellsPage />} />
        <Route path="/prepare" element={<WithCharacter render={(c) => <PreparePage character={c} />} />} />
        <Route path="/today" element={<WithCharacter render={(c) => <TodayPage character={c} />} />} />
        <Route path="/ledger" element={<WithCharacter render={(c) => <LedgerPage character={c} />} />} />
        <Route path="/more" element={<MaybeCharacter render={(c) => <MorePage character={c} />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </HashRouter>
  )
}
