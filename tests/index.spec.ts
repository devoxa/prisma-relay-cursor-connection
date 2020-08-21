/* eslint-disable @typescript-eslint/camelcase */
import {
  PrismaClient,
  UserWhereUniqueInput,
  User,
  ProfileWhereUniqueInput,
  Profile,
} from '@prisma/client'
import { findManyCursorConnection, ConnectionArguments } from '../src'
import { TODO_FIXTURES, USER_FIXTURES, PROFILE_FIXTURES } from './fixtures'

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

  const VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
    ['returns all TODOs', undefined],
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

  describe('number id and unique field', () => {
    beforeAll(async () => {
      await client.user.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== USER_FIXTURES.length; i++) {
        await client.user.create({ data: USER_FIXTURES[i] })
      }
    })

    it('returns all USERs with the base client (sanity check)', async () => {
      const result = await client.user.findMany({})
      expect(result).toEqual(USER_FIXTURES)
    })

    it('returns the paginated USERs with the base client (sanity check)', async () => {
      const idResult = await client.user.findMany({ cursor: { id: 5 }, take: 5, skip: 1 })
      expect(idResult).toMatchSnapshot()

      const emailResult = await client.user.findMany({
        cursor: { email: 'user5@email.com' },
        take: 5,
        skip: 1,
      })
      expect(emailResult).toMatchSnapshot()
    })

    const NUMBER_ID_VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
      ['returns all USERs', undefined],
      ['returns the first 5 USERs', { first: 5 }],
      [
        'returns the first 5 USERs after the 1st user',
        { first: 5, after: encodeCursor({ id: 1 }) },
      ],
      [
        'returns the first 5 USERs after the 5th user',
        { first: 5, after: encodeCursor({ id: 5 }) },
      ],
      [
        'returns the first 5 USERs after the 15th user',
        { first: 5, after: encodeCursor({ id: 15 }) },
      ],
      [
        'returns the first 5 USERs after the 16th user',
        { first: 5, after: encodeCursor({ id: 16 }) },
      ],
      [
        'returns the first 5 USERs after the 20th user',
        { first: 5, after: encodeCursor({ id: 20 }) },
      ],
      ['returns the last 5 USERs', { last: 5 }],
      [
        'returns the last 5 USERs before the 1st user',
        { last: 5, before: encodeCursor({ id: 1 }) },
      ],
      [
        'returns the last 5 USERs before the 5th user',
        { last: 5, before: encodeCursor({ id: 5 }) },
      ],
      [
        'returns the last 5 USERs before the 6th user',
        { last: 5, before: encodeCursor({ id: 6 }) },
      ],
      [
        'returns the last 5 USERs before the 16th user',
        { last: 5, before: encodeCursor({ id: 16 }) },
      ],
    ]

    test.each(NUMBER_ID_VALID_CASES)('%s', async (name, connectionArgs) => {
      const result = await findManyCursorConnection<User, Pick<UserWhereUniqueInput, 'id'>>(
        (args) => client.user.findMany(args),
        () => client.user.count(),
        connectionArgs,
        {
          getCursor: (node) => ({ id: node.id }),
          decodeCursor,
          encodeCursor,
        }
      )

      expect(result).toMatchSnapshot()
    })

    const UNIQUE_FIELD_VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
      [
        'returns the first 5 USERs after the 1st user',
        { first: 5, after: encodeCursor({ email: 'user1@email.com' }) },
      ],
      [
        'returns the first 5 USERs after the 5th user',
        { first: 5, after: encodeCursor({ email: 'user5@email.com' }) },
      ],
      [
        'returns the first 5 USERs after the 15th user',
        { first: 5, after: encodeCursor({ email: 'user15@email.com' }) },
      ],
      [
        'returns the first 5 USERs after the 16th user',
        { first: 5, after: encodeCursor({ email: 'user16@email.com' }) },
      ],
      [
        'returns the first 5 USERs after the 20th user',
        { first: 5, after: encodeCursor({ email: 'user20@email.com' }) },
      ],
      [
        'returns the last 5 USERs before the 1st user',
        { last: 5, before: encodeCursor({ email: 'user1@email.com' }) },
      ],
      [
        'returns the last 5 USERs before the 5th user',
        { last: 5, before: encodeCursor({ email: 'user5@email.com' }) },
      ],
      [
        'returns the last 5 USERs before the 6th user',
        { last: 5, before: encodeCursor({ email: 'user6@email.com' }) },
      ],
      [
        'returns the last 5 USERs before the 16th user',
        { last: 5, before: encodeCursor({ email: 'user16@email.com' }) },
      ],
    ]

    test.each(UNIQUE_FIELD_VALID_CASES)('%s', async (name, connectionArgs) => {
      const result = await findManyCursorConnection<User, Pick<UserWhereUniqueInput, 'email'>>(
        (args) => client.user.findMany(args),
        () => client.user.count(),
        connectionArgs,
        {
          getCursor: (node) => ({ email: node.email }),
          decodeCursor: (cursor) => JSON.parse(Buffer.from(cursor, 'base64').toString('ascii')),
          encodeCursor: (prismaCursor) =>
            Buffer.from(JSON.stringify(prismaCursor)).toString('base64'),
        }
      )

      expect(result).toMatchSnapshot()
    })
  })

  describe('multi field id', () => {
    beforeAll(async () => {
      await client.profile.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== PROFILE_FIXTURES.length; i++) {
        await client.profile.create({ data: PROFILE_FIXTURES[i] })
      }
    })

    it('returns all PROFILEs with the base client (sanity check)', async () => {
      const result = await client.profile.findMany({})
      expect(result).toEqual(PROFILE_FIXTURES)
    })

    it('returns the paginated PROFILEs with the base client (sanity check)', async () => {
      const result = await client.profile.findMany({
        cursor: { firstname_lastname: { firstname: 'foo5', lastname: 'bar1' } },
        take: 5,
        skip: 1,
      })
      expect(result).toMatchSnapshot()
    })

    const MULTI_FIELD_ID_VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
      [
        'returns the first 5 PROFILEs after the 5th profile',
        {
          first: 5,
          after: encodeCursor({ firstname_lastname: { firstname: 'foo1', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the first 5 PROFILEs after the 5th profile',
        {
          first: 5,
          after: encodeCursor({ firstname_lastname: { firstname: 'foo5', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the first 5 PROFILEs after the 15th profile',
        {
          first: 5,
          after: encodeCursor({ firstname_lastname: { firstname: 'foo15', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the first 5 PROFILEs after the 16th profile',
        {
          first: 5,
          after: encodeCursor({ firstname_lastname: { firstname: 'foo16', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the first 5 PROFILEs after the 20th profile',
        {
          first: 5,
          after: encodeCursor({ firstname_lastname: { firstname: 'foo20', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the last 5 PROFILEs before the 1st profile',
        {
          last: 5,
          before: encodeCursor({ firstname_lastname: { firstname: 'foo1', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the last 5 PROFILEs before the 5th profile',
        {
          last: 5,
          before: encodeCursor({ firstname_lastname: { firstname: 'foo5', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the last 5 PROFILEs before the 6th profile',
        {
          last: 5,
          before: encodeCursor({ firstname_lastname: { firstname: 'foo6', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the last 5 PROFILEs before the 16th profile',
        {
          last: 5,
          before: encodeCursor({ firstname_lastname: { firstname: 'foo16', lastname: 'bar1' } }),
        },
      ],
    ]

    test.each(MULTI_FIELD_ID_VALID_CASES)('%s', async (name, connectionArgs) => {
      const result = await findManyCursorConnection<
        Profile,
        Pick<ProfileWhereUniqueInput, 'firstname_lastname'>
      >(
        (args) => client.profile.findMany(args),
        () => client.profile.count(),
        connectionArgs,
        {
          getCursor: (node) => ({
            // eslint-disable-next-line @typescript-eslint/camelcase
            firstname_lastname: {
              firstname: node.firstname,
              lastname: node.lastname,
            },
          }),
          decodeCursor,
          encodeCursor,
        }
      )

      expect(result).toMatchSnapshot()
    })
  })
})

function decodeCursor(cursor: string) {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('ascii'))
}
function encodeCursor<Cursor>(prismaCursor: Cursor) {
  return Buffer.from(JSON.stringify(prismaCursor)).toString('base64')
}
