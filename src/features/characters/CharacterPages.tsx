import { useNavigate } from 'react-router-dom'
import { Loading, Page } from '../../components/ui'
import { createCharacter, updateCharacter } from '../../data/characters'
import { requestPersistentStorage } from '../../data/db'
import { useActiveCharacter, useCharacters } from '../../data/hooks'
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
  if (c === undefined) return <Loading />
  if (c === null) return null
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = c
  return (
    <Page title="Edit wizard" subtitle={c.name}>
      <CharacterForm
        key={c.id}
        initial={input}
        submitLabel="Save"
        onSubmit={async (changes) => {
          await updateCharacter(c.id, changes)
          navigate(-1)
        }}
      />
    </Page>
  )
}
