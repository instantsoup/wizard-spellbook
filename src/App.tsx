import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { Card, Loading, Page } from './components/ui'
import type { CharacterRecord } from './data/db'
import { useActiveCharacter } from './data/hooks'
import { EditCharacterPage, NewCharacterPage } from './features/characters/CharacterPages'
import { StartingSpellsPage } from './features/characters/StartingSpellsPage'
import { MorePage } from './features/more/MorePage'
import { BookPage } from './features/spellbook/BookPage'

/** Renders its child with the active character, or sends the user to setup. */
function WithCharacter({ render }: { render: (c: CharacterRecord) => ReactNode }) {
  const c = useActiveCharacter()
  if (c === undefined) return <Loading />
  if (c === null) return <Navigate to="/setup" replace />
  return <>{render(c)}</>
}

function ComingSoon({ title, what }: { title: string; what: string }) {
  return (
    <Page title={title}>
      <Card className="text-center text-ink/70">{what}</Card>
    </Page>
  )
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
        <Route path="/library" element={<ComingSoon title="Library" what="The spell library with filters and “Add to book” is coming in the next update." />} />
        <Route path="/prepare" element={<ComingSoon title="Prepare" what="Daily spell preparation is coming soon." />} />
        <Route path="/today" element={<ComingSoon title="Today" what="Casting tracker is coming soon." />} />
        <Route path="/more" element={<WithCharacter render={(c) => <MorePage character={c} />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </HashRouter>
  )
}
