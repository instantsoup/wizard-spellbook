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
import { MorePage } from './features/more/MorePage'
import { PreparePage } from './features/prepare/PreparePage'
import { TodayPage } from './features/today/TodayPage'
import { BookPage } from './features/spellbook/BookPage'

/** Renders its child with the active character, or sends the user to setup. */
function WithCharacter({ render }: { render: (c: CharacterRecord) => ReactNode }) {
  const c = useActiveCharacter()
  if (c === undefined) return <Loading />
  if (c === null) return <Navigate to="/setup" replace />
  return <>{render(c)}</>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/book" replace />} />
        <Route path="/setup" element={<NewCharacterPage />} />
        <Route path="/setup/spells" element={<StartingSpellsPage />} />
        <Route path="/character" element={<EditCharacterPage />} />
        <Route path="/book" element={<WithCharacter render={(c) => <BookPage character={c} />} />} />
        <Route path="/library" element={<WithCharacter render={(c) => <LibraryPage character={c} />} />} />
        <Route path="/library/custom" element={<CustomSpellPage />} />
        <Route path="/library/custom/:id" element={<CustomSpellPage />} />
        <Route path="/spells" element={<MySpellsPage />} />
        <Route path="/prepare" element={<WithCharacter render={(c) => <PreparePage character={c} />} />} />
        <Route path="/today" element={<WithCharacter render={(c) => <TodayPage character={c} />} />} />
        <Route path="/more" element={<WithCharacter render={(c) => <MorePage character={c} />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </HashRouter>
  )
}
