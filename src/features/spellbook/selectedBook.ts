// The book the player is looking at, remembered per character so the Library adds to it.

import type { BookRecord } from '../../data/db'

const key = (characterId: string) => `selectedBook:${characterId}`

export function loadSelectedBook(characterId: string): string | undefined {
  try {
    return localStorage.getItem(key(characterId)) ?? undefined
  } catch {
    return undefined
  }
}

export function saveSelectedBook(characterId: string, bookId: string | undefined) {
  try {
    if (bookId) localStorage.setItem(key(characterId), bookId)
    else localStorage.removeItem(key(characterId))
  } catch {
    /* not remembered */
  }
}

/** The remembered book if it still exists, else the starting book. */
export function pickBook(books: BookRecord[], remembered: string | undefined): BookRecord | undefined {
  return books.find((b) => b.id === remembered) ?? books[0]
}
