import { Corpus } from '../src/corpus'
import type { BookMeta, Verse } from '../src/types'

const BOOKS: BookMeta[] = [
  { index: 1, id: 'GEN', english: 'Genesis', hebrew: "Bere'shiyth" },
  { index: 6, id: 'JHN', english: 'John', hebrew: 'Yahuchanon' },
  { index: 9, id: '1SA', english: '1 Samuel', hebrew: "Shemu'el Aleph" },
]

const VERSES: Verse[] = [
  { bookId: 'GEN', chapter: 1, verse: 1, text: 'In the beginning Elohiym created the heavens and the earth.' },
  { bookId: 'GEN', chapter: 1, verse: 2, text: 'Now the earth was formless and void.' },
  { bookId: 'GEN', chapter: 1, verse: 6, text: 'Let there be a firmament between the waters.' },
  { bookId: 'GEN', chapter: 2, verse: 1, text: 'Thus the heavens and the earth were completed.' },
  { bookId: 'JHN', chapter: 3, verse: 16, text: 'For Elohiym so loved the world.' },
  { bookId: '1SA', chapter: 1, verse: 1, text: 'There was a man named Elkanah.' },
]

export function testCorpus(): Corpus {
  return new Corpus(VERSES, BOOKS)
}
