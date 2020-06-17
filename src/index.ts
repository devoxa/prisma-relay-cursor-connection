import { PrismaFindManyArguments, ConnectionArguments, Connection } from './interfaces'

export * from './interfaces'

export async function findManyCursorConnection<Model extends { id: string }>(
  findMany: (args: PrismaFindManyArguments) => Promise<Model[]>,
  aggregate: () => Promise<number>,
  args: ConnectionArguments
): Promise<Connection<Model>> {
  // Make sure the connection arguments are valid and throw an error otherwise
  // istanbul ignore next
  if (!validateArgs(args)) {
    throw new Error('This code path can never happen, only here for type safety')
  }

  let nodes: Array<Model>
  let totalCount: number
  let hasNextPage: boolean
  let hasPreviousPage: boolean

  if (isForwardPagination(args)) {
    // Fetch one additional node to determine if there is a next page
    const take = args.first + 1

    // Convert `after` into prisma `cursor` & `skip`
    const cursor = args.after ? { id: args.after } : undefined
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
  } else {
    // Fetch one additional node to determine if there is a previous page
    const take = -1 * (args.last + 1)

    // Convert `before` into prisma `cursor` & `skip`
    const cursor = args.before ? { id: args.before } : undefined
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
  }

  // The cursors are always the first & last elements of the result set
  const startCursor = nodes.length > 0 ? nodes[0].id : undefined
  const endCursor = nodes.length > 0 ? nodes[nodes.length - 1].id : undefined

  return {
    edges: nodes.map((node) => ({ cursor: node.id, node })),
    pageInfo: { hasNextPage, hasPreviousPage, startCursor, endCursor },
    totalCount: totalCount,
  }
}

function validateArgs(args: ConnectionArguments): args is ConnectionArgumentsUnion {
  if (args.first === undefined && args.last === undefined) {
    throw new Error('One of "first" or "last" must be provided')
  }

  if (args.first != null && args.last != null) {
    throw new Error('Only one of "first" and "last" can be set')
  }

  if (args.after != null && args.before != null) {
    throw new Error('Only one of "after" and "before" can be set')
  }

  if (args.after != null && args.last != null) {
    throw new Error('"after" can not be used with "last"')
  }

  if (args.before != null && args.first != null) {
    throw new Error('"before" can not be used with "first"')
  }

  if (args.first != null && args.first < 0) {
    throw new Error('"first" can not be less than 0')
  }

  if (args.last != null && args.last < 0) {
    throw new Error('"last" can not be less than 0')
  }

  return true
}

type ConnectionArgumentsUnion = ForwardPaginationArguments | BackwardPaginationArguments

type ForwardPaginationArguments = {
  first: number
  after?: string
}

type BackwardPaginationArguments = {
  last: number
  before?: string
}

function isForwardPagination(args: ConnectionArgumentsUnion): args is ForwardPaginationArguments {
  return 'first' in args && args.first != null
}
