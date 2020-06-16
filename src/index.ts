import { PrismaFindManyArguments, ConnectionArguments, Connection } from './interfaces'

export * from './interfaces'

export async function findManyCursorConnection<Model extends { id: string }>(
  findMany: (args: PrismaFindManyArguments) => Promise<Model[]>,
  aggregate: () => Promise<number>,
  args: ConnectionArguments
): Promise<Connection<Model>> {
  // Make sure the connection arguments are valid
  validateArgs(args)

  // Fetch one additional node from the back when paginating forwards with "first",
  // or from the front when paginating backwards with "last"
  const originalLength = (args.first ? args.first : args.last) as number // TS: This is always set
  const first = args.first ? args.first + 1 : undefined
  const last = args.last ? args.last + 1 : undefined

  // Convert `first` & `last` into prisma `take`
  const take = first ? first : last ? -1 * last : undefined

  // Convert `after` & `before` into prisma `cursor` & `skip`
  const after = args.after ? { id: args.after } : undefined
  const before = args.before ? { id: args.before } : undefined
  const cursor = before || after
  const skip = cursor ? 1 : undefined

  // Execute the underlying query operations
  const nodes = await findMany({ cursor, take, skip })
  const totalCount = await aggregate()

  // Check if we got an additional node, indicating a previous/next page
  const hasExtraNode = nodes.length > originalLength

  // Remove the extra node from the results
  if (hasExtraNode && first) {
    nodes.pop()
  }

  if (hasExtraNode && last) {
    nodes.shift()
  }

  // The cursors are always the first & last elements of the result set
  const startCursor = nodes.length > 0 ? nodes[0].id : undefined
  const endCursor = nodes.length > 0 ? nodes[nodes.length - 1].id : undefined

  // If paginating forward:
  // - For the next page, see if we had an extra node in the result set
  // - For the previous page, see if we are "after" another node (so there has to be more before this)
  // If paginating backward:
  // - For the next page, see if we are "before" another node (so there has to be more after this)
  // - For the previous page, see if we had an extra node in the result set
  const hasNextPage = first ? hasExtraNode : !!args.before
  const hasPreviousPage = first ? !!args.after : hasExtraNode

  return {
    edges: nodes.map((node) => ({ cursor: node.id, node })),
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor,
      endCursor,
    },
    totalCount: totalCount,
  }
}

function validateArgs(args: ConnectionArguments) {
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
}
