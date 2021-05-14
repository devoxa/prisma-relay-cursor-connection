import {
  Connection,
  ConnectionArguments,
  Edge,
  Options,
  PrismaFindManyArguments,
} from './interfaces'

export * from './interfaces'

export async function findManyCursorConnection<
  Model = { id: string },
  Cursor = { id: string },
  CustomEdge extends Edge<Model> = Edge<Model>
>(
  findMany: (args: PrismaFindManyArguments<Cursor>) => Promise<Model[]>,
  aggregate: () => Promise<number>,
  args: ConnectionArguments = {},
  pOptions?: Options<Model, Cursor, CustomEdge>
): Promise<Connection<Model>> {
  // Make sure the connection arguments are valid and throw an error otherwise
  // istanbul ignore next
  if (!validateArgs(args)) {
    throw new Error('This code path can never happen, only here for type safety')
  }

  const options = mergeDefaultOptions(pOptions)

  let nodes: Array<Model>
  let totalCount: number
  let hasNextPage: boolean
  let hasPreviousPage: boolean

  if (isForwardPagination(args)) {
    // Fetch one additional node to determine if there is a next page
    const take = args.first + 1

    // Convert `after` into prisma `cursor` & `skip`
    const cursor = decodeCursor(args.after, options)
    const skip = cursor ? 1 : undefined

    // Execute the underlying query operations
    nodes = await findMany({ cursor, take, skip })
    totalCount = await aggregate()

    // See if we are "after" another node, indicating a previous page
    hasPreviousPage = !!args.after

    // See if we have an additional node, indicating a next page
    hasNextPage = nodes.length > args.first

    // Remove the extra node (last element) from the results
    if (hasNextPage) nodes.pop()
  } else if (isBackwardPagination(args)) {
    // Fetch one additional node to determine if there is a previous page
    const take = -1 * (args.last + 1)

    // Convert `before` into prisma `cursor` & `skip`
    const cursor = decodeCursor(args.before, options)
    const skip = cursor ? 1 : undefined

    // Execute the underlying query operations
    nodes = await findMany({ cursor, take, skip })
    totalCount = await aggregate()

    // See if we are "before" another node, indicating a next page
    hasNextPage = !!args.before

    // See if we have an additional node, indicating a previous page
    hasPreviousPage = nodes.length > args.last

    // Remove the extra node (first element) from the results
    if (hasPreviousPage) nodes.shift()
  } else {
    // Execute the underlying query operations
    nodes = await findMany({})
    totalCount = await aggregate()

    // Since we are getting all nodes, there are no pages
    hasNextPage = false
    hasPreviousPage = false
  }

  // The cursors are always the first & last elements of the result set
  const startCursor = nodes.length > 0 ? encodeCursor(nodes[0], options) : undefined
  const endCursor = nodes.length > 0 ? encodeCursor(nodes[nodes.length - 1], options) : undefined

  return {
    edges: nodes.map((node) => ({
      cursor: encodeCursor(node, options),
      ...options.nodeToEdge(node),
    })),
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

function mergeDefaultOptions<Model, Cursor, CustomEdge extends Edge<Model>>(
  pOptions?: Options<Model, Cursor, CustomEdge>
): Required<Options<Model, Cursor, CustomEdge>> {
  return {
    getCursor: (node: Model) =>
      ({ id: (node as unknown as { id: string }).id } as unknown as Cursor),
    encodeCursor: (cursor: Cursor) => (cursor as unknown as { id: string }).id,
    decodeCursor: (cursorString: string) => ({ id: cursorString } as unknown as Cursor),

    nodeToEdge: (node) => ({ node } as Omit<CustomEdge, 'cursor'>),

    ...pOptions,
  }
}

function isForwardPagination(args: ConnectionArgumentsUnion): args is ForwardPaginationArguments {
  return 'first' in args && args.first != null
}

function isBackwardPagination(args: ConnectionArgumentsUnion): args is BackwardPaginationArguments {
  return 'last' in args && args.last != null
}

function decodeCursor<Model, Cursor, CustomEdge extends Edge<Model>>(
  connectionCursor: string | undefined,
  options: Required<Options<Model, Cursor, CustomEdge>>
): Cursor | undefined {
  if (!connectionCursor) {
    return undefined
  }

  return options.decodeCursor(connectionCursor)
}

function encodeCursor<Model, Cursor, CustomEdge extends Edge<Model>>(
  node: Model,
  options: Required<Options<Model, Cursor, CustomEdge>>
): string {
  return options.encodeCursor(options.getCursor(node))
}
