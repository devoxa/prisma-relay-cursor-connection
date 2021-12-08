// Originally based on the MIT licensed source code from:
// https://github.com/artsy/metaphysics/blob/9492e190ea8550ddd6a3532e0e0ae10ce0022a38/src/schema/v2/fields/pagination.ts

import { ConnectionArguments, PageCursors } from './interfaces'

const PAGE_NUMBER_CAP = 100

export function createPageCursors(
  totalCount: number,
  args: ConnectionArguments,
  initialCursor: string | undefined | null,
  max = 5
) {
  const size = args.first || args.last || 10

  let currentPage = 1
  if (initialCursor && initialCursor.includes('-')) {
    // Did it come in with a page number? If so we need to strip it out so that the
    // create pageCursors and prefix it with their page
    currentPage = parseInt(initialCursor.split('-')[0])
    initialCursor = initialCursor.split('-')[1]
  }

  // If max is even, bump it up by 1, and log out a warning.
  if (max % 2 === 0) {
    console.warn(`Max of ${max} passed to page cursors, using ${max + 1}`)
    max = max + 1
  }

  const totalPages = computeTotalPages(totalCount, size)

  let pageCursors: PageCursors
  // Degenerate case of no records found.
  if (totalPages === 0) {
    pageCursors = { around: [pageToCursorObject(1, 1)] }
  } else if (totalPages <= max) {
    // Collection is short, and `around` includes page 1 and the last page.
    pageCursors = {
      around: pageCursorsToArray(1, totalPages, currentPage),
    }
  } else if (currentPage <= Math.floor(max / 2) + 1) {
    // We are near the beginning, and `around` will include page 1.
    pageCursors = {
      last: pageToCursorObject(totalPages, currentPage),
      around: pageCursorsToArray(1, max - 1, currentPage),
    }
  } else if (currentPage >= totalPages - Math.floor(max / 2)) {
    // We are near the end, and `around` will include the last page.
    pageCursors = {
      first: pageToCursorObject(1, currentPage),
      around: pageCursorsToArray(totalPages - max + 2, totalPages, currentPage),
    }
  } else {
    // We are in the middle, and `around` doesn't include the first or last page.
    const offset = Math.floor((max - 3) / 2)
    pageCursors = {
      first: pageToCursorObject(1, currentPage),
      around: pageCursorsToArray(currentPage - offset, currentPage + offset, currentPage),
      last: pageToCursorObject(totalPages, currentPage),
    }
  }

  if (currentPage > 1 && totalPages > 1) {
    pageCursors.previous = pageToCursorObject(currentPage - 1, currentPage)
  }

  return pageCursors

  // Returns an opaque cursor for a page, which is page number and the
  // initial anchored ID to page from.
  function pageToCursorObject(page: number, currentPage: number) {
    return {
      cursor: `${page}-${initialCursor}`,
      page,
      isCurrent: currentPage === page,
    }
  }

  // Returns an array of PageCursor objects
  // from start to end (page numbers).
  function pageCursorsToArray(start: number, end: number, currentPage: number) {
    let page
    const cursors = []
    for (page = start; page <= end; page++) {
      cursors.push(pageToCursorObject(page, currentPage))
    }
    return cursors
  }

  // Returns the total number of possible pagination results.
  function computeTotalPages(totalRecords: number, size: number) {
    return Math.min(Math.ceil(totalRecords / size), PAGE_NUMBER_CAP)
  }
}
