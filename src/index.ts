import {
  Connection,
  ConnectionArguments,
  Edge,
  Options,
  PrismaFindManyArguments
} from './interfaces'
import { createPageCursors } from './pageCursorsHelpers'

export * from './interfaces'

export async function findManyCursorConnection<
  Record = { id: string },
  Cursor = { id: string },
  Node = Record,
  CustomEdge extends Edge<Node> = Edge<Node>
>(
  findMany: (args: PrismaFindManyArguments<Cursor>) => Promise<Record[]>,
  aggregate: () => Promise<number>,
  args: ConnectionArguments = {},
  pOptions?: Options<Record, Cursor, Node, CustomEdge>
): Promise<Connection<Node, CustomEdge>> {
  // Make sure the connection arguments are valid and throw an error otherwise
  // istanbul ignore next
  if (!validateArgs(args)) {
    throw new Error('This code path can never happen, only here for type safety')
  }

  const options = mergeDefaultOptions(pOptions)

  let records: Array<Record>
  let totalCount: number
  let hasNextPage: boolean
  let hasPreviousPage: boolean

  if (isForwardPagination(args)) {
    // Convert `after` into prisma `cursor` & `skip`
    const inputCursor = decodeCursor(args.after, options)

    // Extract the arguments for the findMany
    const { cursor, take, skip } = options.findManyParamsWithCursor(args, inputCursor)

    // Execute the underlying query operations
    records = await findMany({ cursor, take, skip })
    totalCount = await aggregate()

    // See if we are "after" another record, indicating a previous page
    hasPreviousPage = !!args.after

    // See if we have an additional record, indicating a next page
    hasNextPage = records.length > args.first

    // Remove the extra record (last element) from the results
    if (hasNextPage) records.pop()
  } else if (isBackwardPagination(args)) {

    // Convert `before` into prisma `cursor` & `skip`
    const initialCursor = decodeCursor(args.before, options)

    // Extract the arguments for the findMany
    const { cursor, take, skip } = options.findManyParamsWithCursor(args, initialCursor)

    // Execute the underlying query operations
    records = await findMany({ cursor, take, skip })
    totalCount = await aggregate()

    // See if we are "before" another record, indicating a next page
    hasNextPage = !!args.before

    // See if we have an additional record, indicating a previous page
    hasPreviousPage = records.length > args.last

    // Remove the extra record (first element) from the results
    if (hasPreviousPage) records.shift()
  } else {
    // Execute the underlying query operations
    records = await findMany({})
    totalCount = await aggregate()

    // Since we are getting all records, there are no pages
    hasNextPage = false
    hasPreviousPage = false
  }

  // The cursors are always the first & last elements of the result set
  const startCursor = records.length > 0 ? encodeCursor(records[0], options) : undefined
  const endCursor =
    records.length > 0 ? encodeCursor(records[records.length - 1], options) : undefined

  return {
    edges: records.map(
      (record) =>
      ({
        ...options.recordToEdge(record),
        cursor: encodeCursor(record, options),
      } as CustomEdge)
    ),
    pageInfo: { hasNextPage, hasPreviousPage, startCursor, endCursor },
    totalCount: totalCount,
  }
}

function validateArgs(args: ConnectionArguments): args is ConnectionArgumentsUnion {
  // Only one of `first` and `last` / `after` and `before` can be set
  if (args.first != null && args.last != null) {
    throw new Error('Only one of "first" and "last" can be set')
  }

  if (args.after != null && args.before != null) {
    throw new Error('Only one of "after" and "before" can be set')
  }

  // If `after` is set, `first` has to be set
  if (args.after != null && args.first == null) {
    throw new Error('"after" needs to be used with "first"')
  }

  // If `before` is set, `last` has to be set
  if (args.before != null && args.last == null) {
    throw new Error('"before" needs to be used with "last"')
  }

  // `first` and `last` have to be positive
  if (args.first != null && args.first <= 0) {
    throw new Error('"first" has to be positive')
  }

  if (args.last != null && args.last <= 0) {
    throw new Error('"last" has to be positive')
  }

  return true
}

type ConnectionArgumentsUnion =
  | ForwardPaginationArguments
  | BackwardPaginationArguments
  | NoPaginationArguments

type ForwardPaginationArguments = { first: number; after?: string }
type BackwardPaginationArguments = { last: number; before?: string }
type NoPaginationArguments = Record<string, unknown>

type MergedOptions<Record, Cursor, Node, CustomEdge extends Edge<Node>> = Required<
  Options<Record, Cursor, Node, CustomEdge>
>

function mergeDefaultOptions<Record, Cursor, Node, CustomEdge extends Edge<Node>>(
  pOptions?: Options<Record, Cursor, Node, CustomEdge>
): MergedOptions<Record, Cursor, Node, CustomEdge> {
  return {
    getCursor: (record: Record) =>
      ({ id: (record as unknown as { id: string }).id } as unknown as Cursor),
    encodeCursor: (cursor: Cursor) => (cursor as unknown as { id: string }).id,
    decodeCursor: (cursorString: string) => ({ id: cursorString } as unknown as Cursor),
    recordToEdge: (record: Record) => ({ node: record } as unknown as Omit<CustomEdge, 'cursor'>),
    findManyParamsWithCursor: (args, cursor) => {
      // Fetch one additional record to determine if there is a next page
      const take = args.first ? args.first + 1 : -1 * ((args.last || 0) + 1)

      // Convert `before` into prisma `cursor` & `skip`
      const skip = cursor ? 1 : undefined

      // Pass through the cursor
      return { take, skip, cursor }
    },
    ...pOptions,
  }
}

function isForwardPagination(args: ConnectionArgumentsUnion): args is ForwardPaginationArguments {
  return 'first' in args && args.first != null
}

function isBackwardPagination(args: ConnectionArgumentsUnion): args is BackwardPaginationArguments {
  return 'last' in args && args.last != null
}

function decodeCursor<Record, Cursor, Node, CustomEdge extends Edge<Node>>(
  connectionCursor: string | undefined,
  options: MergedOptions<Record, Cursor, Node, CustomEdge>
): Cursor | undefined {
  if (!connectionCursor) {
    return undefined
  }

  return options.decodeCursor(connectionCursor)
}

function encodeCursor<Record, Cursor, Node, CustomEdge extends Edge<Node>>(
  record: Record,
  options: MergedOptions<Record, Cursor, Node, CustomEdge>
): string {
  return options.encodeCursor(options.getCursor(record))
}


export async function findManyCursorConnectionWithPageCursors<
  Record = { id: string },
  Cursor = { id: string, page: number },
  Node = Record,
  CustomEdge extends Edge<Node> = Edge<Node>
>(
  findMany: (args: PrismaFindManyArguments<Cursor>) => Promise<Record[]>,
  aggregate: () => Promise<number>,
  args: ConnectionArguments = {},
  pOptions?: Omit<Options<Record, Cursor, Node, CustomEdge>, "decodeCursor" | "encodeCursor" | "findManyParamsWithCursor">
): Promise<Connection<Node, CustomEdge>> {

  const options: Options<Record, Cursor, Node, CustomEdge> = {
    ...pOptions,
    decodeCursor: (cursor: string) => {
      // All cuids start with "c", so if it's not then we're good to go
      if (!cursor.startsWith("c")) {
        const [page, id] = cursor.split("-")
        return ({ id, page: parseInt(page) } as unknown as Cursor)
      } else {
        return ({ id: cursor, page: undefined } as unknown as Cursor)
      }
    },

    encodeCursor: (cursor: Cursor) => {
      const cAny = cursor as unknown as { id: string, page?: number }
      const cID = "id" in cursor ? cAny.id as string : ""
      return "page" in cursor ? `${cAny.page}-${cID}` : cID
    },

    findManyParamsWithCursor: (args, cursor) => {
      // Fetch one additional record to determine if there is a next page
      const take = args.first ? args.first + 1 : -1 * ((args.last || 0) + 1)

      // Convert `before` into prisma `cursor` & `skip`
      let skip = cursor ? 1 : undefined

      // We need push the skip value along based on the amount
      // pages we've referenced
      if (skip && cursor && "page" in cursor) {
        const ordinal = args.first || args.last || 10
        // The +1 is because you must have seen a full page, so 'page 1' is really page 2
        skip = (ordinal * ((cursor as unknown as { page: number }).page - 1))

        console.log({ skip, cursor, take })
        // We need to delete the 'page' field in the cursor, because that's
        // not a field for prisma, but our book-keeping
        delete (cursor as unknown as { page?: number }).page
      }

      return { take, skip, cursor }
    },
  }

  const connection = await findManyCursorConnection(findMany, aggregate, args, options)
  console.log({ connection })

  let initialCursor = args.after || args.before

  // If we don't have the initial cursor to anchor to, we'll need to grab the first
  if (!initialCursor) {
    const direction = args.first ? "desc" : "asc"
    const firstItem = await findMany({ take: 1, orderBy: { id: direction } })
    if (firstItem[0]) initialCursor = (firstItem[0] as unknown as { id: string }).id
  }

  connection.pageCursors = createPageCursors(connection.totalCount, args, initialCursor)
  return connection
}
