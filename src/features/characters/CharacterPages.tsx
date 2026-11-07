import { useNavigate } from 'react-router-dom'
import { Loading, Page } from '../../components/ui'
import { createCharacter, knownSpellsInSchools, updateCharacterAndBook } from '../../data/characters'
import { requestPersistentStorage } from '../../data/db'
import { useActiveCharacter, useCharacters } from '../../data/hooks'
import { useSpells } from '../../data/spells'
import { CharacterForm } from './CharacterForm'

export function NewCharacterPage() {
  const navigate = useNavigate()
  const characters = useCharacters()
  return (
    <Page title="New wizard" subtitle={characters?.length ? undefined : 'Welcome! Start by describing your wizard.'}>
      <CharacterForm
        isNew
        submitLabel="Create wizard"
        onSubmit={async (input) => {
          await createCharacter(input)
          void requestPersistentStorage()
          navigate('/setup/spells', { replace: true })
        }}
      />
    </Page>
  )
}

export function EditCharacterPage() {
  const navigate = useNavigate()
  const c = useActiveCharacter()
  const { byId, loading } = useSpells()
  if (c === undefined || loading) return <Loading />
  if (c === null) return null
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = c
  return (
    <Page title="Edit wizard" subtitle={c.name}>
      <CharacterForm
        key={c.id}
        initial={input}
        submitLabel="Save"
        onSubmit={async (changes) => {
          // Spells from schools that are now prohibited leave the book.
          const newlyProhibited = changes.prohibited.filter((s) => !c.prohibited.includes(s))
          const doomed = await knownSpellsInSchools(c.id, newlyProhibited, byId)
          if (doomed.length) {
            const names = doomed.map((k) => byId.get(k.spellId)?.name ?? k.spellId)
            const list = names.slice(0, 8).join(', ') + (names.length > 8 ? `, and ${names.length - 8} more` : '')
            if (!confirm(`${doomed.length} spell${doomed.length === 1 ? '' : 's'} in your book ${doomed.length === 1 ? 'is' : 'are'} from ${newlyProhibited.join(' or ')} and will be removed: ${list}.`)) return
          }
          await updateCharacterAndBook(c.id, changes, doomed.map((k) => k.id))
          navigate(-1)
        }}
      />
    </Page>
  )
}
