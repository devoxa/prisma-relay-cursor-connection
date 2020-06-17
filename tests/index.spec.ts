import { PrismaClient } from '@prisma/client'
import { findManyCursorConnection, ConnectionArguments } from '../src'
import { TODO_FIXTURES } from './fixtures'

describe('prisma-relay-cursor-connection', () => {
  let client: PrismaClient

  beforeAll(async () => {
    client = new PrismaClient()

    await client.todo.deleteMany({})

    // Build up the fixtures sequentially so they are in a consistent order
    for (let i = 0; i !== TODO_FIXTURES.length; i++) {
      await client.todo.create({ data: TODO_FIXTURES[i] })
    }
  })

  afterAll(async () => {
    await client.disconnect()
  })

  it('returns all TODOs with the base client (sanity check)', async () => {
    const result = await client.todo.findMany({})
    expect(result).toEqual(TODO_FIXTURES)
  })

  it('returns the paginated TODOs with the base client (sanity check)', async () => {
    const result = await client.todo.findMany({ cursor: { id: 'id_05' }, take: 5, skip: 1 })
    expect(result).toMatchSnapshot()
  })

  const VALID_CASES: Array<[string, ConnectionArguments]> = [
    ['returns all TODOs', { first: 10000 }],
    ['returns the first 5 TODOs', { first: 5 }],
    ['returns the first 5 TODOs after the 1st todo', { first: 5, after: 'id_01' }],
    ['returns the first 5 TODOs after the 5th todo', { first: 5, after: 'id_05' }],
    ['returns the first 5 TODOs after the 15th todo', { first: 5, after: 'id_15' }],
    ['returns the first 5 TODOs after the 16th todo', { first: 5, after: 'id_16' }],
    ['returns the first 5 TODOs after the 20th todo', { first: 5, after: 'id_20' }],
    ['returns the last 5 TODOs', { last: 5 }],
    ['returns the last 5 TODOs before the 1st todo', { last: 5, before: 'id_01' }],
    ['returns the last 5 TODOs before the 5th todo', { last: 5, before: 'id_05' }],
    ['returns the last 5 TODOs before the 6th todo', { last: 5, before: 'id_06' }],
    ['returns the last 5 TODOs before the 16th todo', { last: 5, before: 'id_16' }],
  ]

  test.each(VALID_CASES)('%s', async (name, connectionArgs) => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      connectionArgs
    )

    expect(result).toMatchSnapshot()
  })

  it('returns the first 5 completed TODOs', async () => {
    const baseArgs = {
      select: { id: true, isCompleted: true },
      where: { isCompleted: true },
    }

    const result = await findManyCursorConnection(
      (args) => client.todo.findMany({ ...args, ...baseArgs }),
      () => client.todo.count(baseArgs),
      { first: 5 }
    )

    expect(result).toMatchSnapshot()

    // Test that the return types work via TS
    result.edges[0].node.isCompleted

    // @ts-expect-error Typo in selected field
    result.edges[0].node.isCompletedd

    // @ts-expect-error Not selected field
    result.edges[0].node.text
  })

  const INVALID_CASES: Array<[string, ConnectionArguments]> = [
    ['errors for invalid arguments (negative first)', { first: -5 }],
    ['errors for invalid arguments (negative last)', { last: -5 }],
    ['errors for invalid arguments (no first & no last)', {}],
    ['errors for invalid arguments (both first & last)', { first: 5, last: 5 }],
    ['errors for invalid arguments (both after & before)', { after: 'id_05', before: 'id_15' }],
    [
      'errors for invalid arguments (both after & before with first)',
      { first: 5, after: 'id_05', before: 'id_15' },
    ],
    ['errors for invalid arguments (after without first)', { after: 'id_05' }],
    ['errors for invalid arguments (before without last)', { before: 'id_15' }],
    ['errors for invalid arguments (after with last)', { last: 5, after: 'id_05' }],
    ['errors for invalid arguments (before with first)', { first: 5, before: 'id_15' }],
    [
      'errors for invalid arguments (kitchensink)',
      { first: 5, after: 'id_05', last: 5, before: 'id_15' },
    ],
  ]

  test.each(INVALID_CASES)('%s', async (name, connectionArgs) => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        connectionArgs
      )
    } catch (err) {
      error = err
    }

    expect(error).not.toEqual(undefined)
    expect(error).toMatchSnapshot()
  })
})
