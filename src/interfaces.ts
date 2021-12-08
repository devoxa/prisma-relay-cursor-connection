// Prisma Relay Cursor Connection Arguments
export interface Options<Record, Cursor, Node, CustomEdge extends Edge<Node>> {
  getCursor?: (record: Record) => Cursor
  findManyParamsWithCursor?: (
    args: ConnectionArguments,
    cursor: Cursor | undefined
  ) => { cursor: Cursor | undefined; skip: number | undefined; take: number }
  encodeCursor?: (cursor: Cursor) => string
  decodeCursor?: (cursorString: string) => Cursor

  recordToEdge?: (record: Record) => Omit<CustomEdge, 'cursor'>
}

// Prisma Arguments
export interface PrismaFindManyArguments<Cursor> {
  cursor?: Cursor
  take?: number
  skip?: number
  orderBy?: Record<string, 'asc' | 'desc' | undefined>
}

// Relay Arguments
export interface ConnectionArguments {
  first?: number | null
  after?: string | null
  last?: number | null
  before?: string | null
}

// Relay Response
export interface Connection<T, CustomEdge extends Edge<T> = Edge<T>> {
  edges: Array<CustomEdge>
  pageInfo: PageInfo
  totalCount: number
  pageCursors?: PageCursors
}

export interface Edge<T> {
  cursor: string
  node: T
}

export interface PageInfo {
  hasNextPage: boolean
  hasPreviousPage: boolean
  startCursor?: string
  endCursor?: string
}

// Page Cursors Extension
export interface PageCursor {
  cursor: string
  page: number
  isCurrent: boolean
}

export interface PageCursors {
  first?: PageCursor | undefined
  around: PageCursor[]
  last?: PageCursor
  previous?: PageCursor
}
