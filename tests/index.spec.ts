import { PrismaClient, UserWhereUniqueInput, User } from '@prisma/client'
import { findManyCursorConnection, ConnectionArguments, toCursorHash, fromCursorHash } from '../src'
import { TODO_FIXTURES, USER_FIXTURES } from './fixtures'

describe('prisma-relay-cursor-connection', () => {
  let client: PrismaClient

  beforeAll(async () => {
    client = new PrismaClient()

    await client.todo.deleteMany({})
    await client.user.deleteMany({})

    // Build up the fixtures sequentially so they are in a consistent order
    for (let i = 0; i !== TODO_FIXTURES.length; i++) {
      await client.todo.create({ data: TODO_FIXTURES[i] })
    }

    // Build up the fixtures sequentially so they are in a consistent order
    for (let i = 0; i !== USER_FIXTURES.length; i++) {
      await client.user.create({ data: USER_FIXTURES[i] })
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

  const VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
    ['returns all TODOs', undefined],
    ['returns the first 5 TODOs', { first: 5 }],

    [
      'returns the first 5 TODOs after the 1st todo',
      { first: 5, after: toCursorHash({ id: 'id_01' }) },
    ],
    [
      'returns the first 5 TODOs after the 5th todo',
      { first: 5, after: toCursorHash({ id: 'id_05' }) },
    ],
    [
      'returns the first 5 TODOs after the 15th todo',
      { first: 5, after: toCursorHash({ id: 'id_15' }) },
    ],
    [
      'returns the first 5 TODOs after the 16th todo',
      { first: 5, after: toCursorHash({ id: 'id_16' }) },
    ],
    [
      'returns the first 5 TODOs after the 20th todo',
      { first: 5, after: toCursorHash({ id: 'id_20' }) },
    ],
    ['returns the last 5 TODOs', { last: 5 }],
    [
      'returns the last 5 TODOs before the 1st todo',
      { last: 5, before: toCursorHash({ id: 'id_01' }) },
    ],
    [
      'returns the last 5 TODOs before the 5th todo',
      { last: 5, before: toCursorHash({ id: 'id_05' }) },
    ],
    [
      'returns the last 5 TODOs before the 6th todo',
      { last: 5, before: toCursorHash({ id: 'id_06' }) },
    ],
    [
      'returns the last 5 TODOs before the 16th todo',
      { last: 5, before: toCursorHash({ id: 'id_16' }) },
    ],
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
    ['errors for invalid arguments (both first & last)', { first: 5, last: 5 }],
    [
      'errors for invalid arguments (both after & before)',
      { after: toCursorHash({ id: 'id_05' }), before: toCursorHash({ id: 'id_15' }) },
    ],
    [
      'errors for invalid arguments (both after & before with first)',
      { first: 5, after: toCursorHash({ id: 'id_05' }), before: toCursorHash({ id: 'id_15' }) },
    ],
    [
      'errors for invalid arguments (after without first)',
      { after: toCursorHash({ id: 'id_05' }) },
    ],
    [
      'errors for invalid arguments (before without last)',
      { before: toCursorHash({ id: 'id_15' }) },
    ],
    [
      'errors for invalid arguments (after with last)',
      { last: 5, after: toCursorHash({ id: 'id_05' }) },
    ],
    [
      'errors for invalid arguments (before with first)',
      { first: 5, before: toCursorHash({ id: 'id_15' }) },
    ],
    [
      'errors for invalid arguments (kitchensink)',
      {
        first: 5,
        after: toCursorHash({ id: 'id_05' }),
        last: 5,
        before: toCursorHash({ id: 'id_15' }),
      },
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

  const NUMBER_ID_VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
    ['returns all USERs', undefined],
    ['returns the first 5 USERs', { first: 5 }],
    ['returns the first 5 USERs after the 1st user', { first: 5, after: toCursorHash({ id: 1 }) }],
    ['returns the first 5 USERs after the 5th user', { first: 5, after: toCursorHash({ id: 5 }) }],
    [
      'returns the first 5 USERs after the 15th user',
      { first: 5, after: toCursorHash({ id: 15 }) },
    ],
    [
      'returns the first 5 USERs after the 16th user',
      { first: 5, after: toCursorHash({ id: 16 }) },
    ],
    [
      'returns the first 5 USERs after the 20th user',
      { first: 5, after: toCursorHash({ id: 20 }) },
    ],
    ['returns the last 5 USERs', { last: 5 }],
    ['returns the last 5 USERs before the 1st user', { last: 5, before: toCursorHash({ id: 1 }) }],
    ['returns the last 5 USERs before the 5th user', { last: 5, before: toCursorHash({ id: 5 }) }],
    ['returns the last 5 USERs before the 6th user', { last: 5, before: toCursorHash({ id: 6 }) }],
    [
      'returns the last 5 USERs before the 16th user',
      { last: 5, before: toCursorHash({ id: 16 }) },
    ],
  ]

  test.each(NUMBER_ID_VALID_CASES)('%s', async (name, connectionArgs) => {
    const result = await findManyCursorConnection<User, Pick<UserWhereUniqueInput, 'id'>>(
      (args) => client.user.findMany(args),
      () => client.user.count(),
      connectionArgs,
      (node) => ({ id: node.id })
    )

    expect(result).toMatchSnapshot()
  })

  const UNIQUE_FIELD_VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
    [
      'returns the first 5 USERs after user1@email.com',
      { first: 5, after: toCursorHash({ email: 'user1@email.com' }) },
    ],
  ]

  test.each(UNIQUE_FIELD_VALID_CASES)('%s', async (name, connectionArgs) => {
    const result = await findManyCursorConnection<User, Pick<UserWhereUniqueInput, 'email'>>(
      (args) => client.user.findMany(args),
      () => client.user.count(),
      connectionArgs,
      (node) => ({ email: node.email })
    )

    expect(result).toMatchSnapshot()
  })

  const MULTI_FIELD_ID_VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
    [
      'returns the first 5 USERs after username: user1, isAdmin: true',
      { first: 5, after: toCursorHash({ email: 'user1@email.com' }) },
    ],
  ]

  test.each(MULTI_FIELD_ID_VALID_CASES)('%s', async (name, connectionArgs) => {
    const result = await findManyCursorConnection<
      User,
      Pick<UserWhereUniqueInput, 'username_isAdmin'>
    >(
      (args) => client.user.findMany(args),
      () => client.user.count(),
      connectionArgs,
      (node) => ({
        // eslint-disable-next-line @typescript-eslint/camelcase
        username_isAdmin: {
          isAdmin: node.isAdmin as boolean,
          username: node.username,
        },
      })
    )

    expect(result).toMatchSnapshot()
  })

  describe('toCursorHash', () => {
    it('cursor object to base64 string cursor', () => {
      expect(toCursorHash({ id: '1234' })).toEqual('eyJpZCI6IjEyMzQifQ==')
      expect(toCursorHash({ recipeId: '1234', authorId: '12334' })).toEqual(
        'eyJyZWNpcGVJZCI6IjEyMzQiLCJhdXRob3JJZCI6IjEyMzM0In0='
      )
    })
  })

  describe('fromCursorHash', () => {
    it('base64 string cursor to cursor object', () => {
      expect(fromCursorHash(toCursorHash({ id: '1234' }))).toEqual({ id: '1234' })
      expect(fromCursorHash(toCursorHash({ id: 1234 }))).toEqual({ id: 1234 })
      expect(fromCursorHash(toCursorHash({ recipeId: '1234', authorId: '12334' }))).toEqual({
        recipeId: '1234',
        authorId: '12334',
      })
    })
  })
})
