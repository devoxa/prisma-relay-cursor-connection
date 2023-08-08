import graphqlFields from 'graphql-fields'
import {
  Connection,
  ConnectionArguments,
  Edge,
  Options,
  PrismaFindManyArguments,
} from './interfaces'

export * from './interfaces'

export async function findManyCursorConnection<
  Record = { id: string },
  Cursor = { id: string },
  Node = Record,
  CustomEdge extends Edge<Node> = Edge<Node>,
>(
  findMany: (args: PrismaFindManyArguments<Cursor>) => Promise<Record[]>,
  aggregate: () => Promise<number>,
  args: ConnectionArguments = {},
  pOptions?: Options<Record, Cursor, Node, CustomEdge>
): Promise<Connection<Node, CustomEdge>> {
  // Make sure the connection arguments are valid and throw an error otherwise
  /* c8 ignore next 3 */
  if (!validateArgs(args)) {
    throw new Error('This code path can never happen, only here for type safety')
  }

  const options = mergeDefaultOptions(pOptions)
  const requestedFields = options.resolveInfo && Object.keys(graphqlFields(options.resolveInfo))
  const hasRequestedField = (key: string) => !requestedFields || requestedFields.includes(key)

  let records: Array<Record>
  let totalCount: number
  let hasNextPage: boolean
  let hasPreviousPage: boolean

  if (isForwardPagination(args)) {
    // Fetch one additional record to determine if there is a next page
    const take = args.first + 1

    // Convert `after` into prisma `cursor` & `skip`
    const cursor = decodeCursor(args.after, options)
    const skip = cursor ? 1 : undefined

    // Execute the underlying query operations
    records = await findMany({ cursor, take, skip })
    totalCount = hasRequestedField('totalCount') ? await aggregate() : -1

    // See if we are "after" another record, indicating a previous page
    hasPreviousPage = !!args.after

    // See if we have an additional record, indicating a next page
    hasNextPage = records.length > args.first

    // Remove the extra record (last element) from the results
    if (hasNextPage) records.pop()
  } else if (isBackwardPagination(args)) {
    // Fetch one additional record to determine if there is a previous page
    const take = -1 * (args.last + 1)

    // Convert `before` into prisma `cursor` & `skip`
    const cursor = decodeCursor(args.before, options)
    const skip = cursor ? 1 : undefined

    // Execute the underlying query operations
    records = await findMany({ cursor, take, skip })
    totalCount = hasRequestedField('totalCount') ? await aggregate() : -1

    // See if we are "before" another record, indicating a next page
    hasNextPage = !!args.before

    // See if we have an additional record, indicating a previous page
    hasPreviousPage = records.length > args.last

    // Remove the extra record (first element) from the results
    if (hasPreviousPage) records.shift()
  } else {
    // Execute the underlying query operations
    records = hasRequestedField('edges') || hasRequestedField('nodes') ? await findMany({}) : []
    totalCount = hasRequestedField('totalCount') ? await aggregate() : -1

    // Since we are getting all records, there are no pages
    hasNextPage = false
    hasPreviousPage = false
  }

  // The cursors are always the first & last elements of the result set
  const startCursor = records.length > 0 ? encodeCursor(records[0], options) : undefined
  const endCursor =
    records.length > 0 ? encodeCursor(records[records.length - 1], options) : undefined

  // Allow the recordToEdge function to return a custom edge type which will be inferred
  type EdgeExtended = typeof options.recordToEdge extends (record: Record) => infer X
    ? X extends CustomEdge
      ? X & { cursor: string }
      : CustomEdge
    : CustomEdge

  const edges = records.map((record) => {
    return {
      ...options.recordToEdge(record),
      cursor: encodeCursor(record, options),
    } as EdgeExtended
  })

  return {
    edges,
    nodes: edges.map((edge) => edge.node),
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
      ({ id: (record as unknown as { id: string }).id }) as unknown as Cursor,
    encodeCursor: (cursor: Cursor) => (cursor as unknown as { id: string }).id,
    decodeCursor: (cursorString: string) => ({ id: cursorString }) as unknown as Cursor,
    recordToEdge: (record: Record) => ({ node: record }) as unknown as Omit<CustomEdge, 'cursor'>,
    resolveInfo: null,
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
