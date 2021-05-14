import { Prisma, PrismaClient, Profile, User } from '@prisma/client'
import { ConnectionArguments, findManyCursorConnection } from '../src'
import { PROFILE_FIXTURES, TODO_FIXTURES, USER_FIXTURES } from './fixtures'

function encodeCursor<Cursor>(prismaCursor: Cursor) {
  return Buffer.from(JSON.stringify(prismaCursor)).toString('base64')
}

function decodeCursor(cursor: string) {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('ascii'))
}

describe('prisma-relay-cursor-connection', () => {
  jest.setTimeout(10000)
  let client: PrismaClient

  beforeAll(async () => {
    client = new PrismaClient()
  })

  afterAll(async () => {
    await client.$disconnect()
  })

  describe('string id', () => {
    beforeAll(async () => {
      await client.todo.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== TODO_FIXTURES.length; i++) {
        await client.todo.create({ data: TODO_FIXTURES[i] })
      }
    })

    it('returns all todos with the base client (sanity check)', async () => {
      const result = await client.todo.findMany({})
      expect(result).toEqual(TODO_FIXTURES)
    })

    it('returns the paginated todos with the base client (sanity check)', async () => {
      const result = await client.todo.findMany({ cursor: { id: 'id_05' }, take: 5, skip: 1 })
      expect(result).toMatchSnapshot()
    })

    const VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
      ['returns all todos', undefined],
      ['returns the first 5 todos', { first: 5 }],
      ['returns the first 5 todos after the 1st todo', { first: 5, after: 'id_01' }],
      ['returns the first 5 todos after the 5th todo', { first: 5, after: 'id_05' }],
      ['returns the first 5 todos after the 15th todo', { first: 5, after: 'id_15' }],
      ['returns the first 5 todos after the 16th todo', { first: 5, after: 'id_16' }],
      ['returns the first 5 todos after the 20th todo', { first: 5, after: 'id_20' }],
      ['returns the last 5 todos', { last: 5 }],
      ['returns the last 5 todos before the 1st todo', { last: 5, before: 'id_01' }],
      ['returns the last 5 todos before the 5th todo', { last: 5, before: 'id_05' }],
      ['returns the last 5 todos before the 6th todo', { last: 5, before: 'id_06' }],
      ['returns the last 5 todos before the 16th todo', { last: 5, before: 'id_16' }],
    ]

    test.each(VALID_CASES)('%s', async (name, connectionArgs) => {
      const result = await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        connectionArgs
      )

      expect(result).toMatchSnapshot()
    })

    it('returns the first 5 completed todos', async () => {
      const baseArgs = {
        select: { id: true, isCompleted: true },
        where: { isCompleted: true },
      }

      const result = await findManyCursorConnection(
        (args) => client.todo.findMany({ ...args, ...baseArgs }),
        () => client.todo.count({ where: baseArgs.where }),
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
  })

  describe('number id', () => {
    beforeAll(async () => {
      await client.user.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== USER_FIXTURES.length; i++) {
        await client.user.create({ data: USER_FIXTURES[i] })
      }
    })

    it('returns all users with the base client (sanity check)', async () => {
      const result = await client.user.findMany({})
      expect(result).toEqual(USER_FIXTURES)
    })

    it('returns the paginated users with the base client (sanity check)', async () => {
      const result = await client.user.findMany({ cursor: { id: 5 }, take: 5, skip: 1 })
      expect(result).toMatchSnapshot()
    })

    const NUMBER_ID_VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
      ['returns all users', undefined],
      ['returns the first 5 users', { first: 5 }],
      [
        'returns the first 5 users after the 1st user',
        { first: 5, after: encodeCursor({ id: 1 }) },
      ],
      [
        'returns the first 5 users after the 5th user',
        { first: 5, after: encodeCursor({ id: 5 }) },
      ],
      [
        'returns the first 5 users after the 15th user',
        { first: 5, after: encodeCursor({ id: 15 }) },
      ],
      [
        'returns the first 5 users after the 16th user',
        { first: 5, after: encodeCursor({ id: 16 }) },
      ],
      [
        'returns the first 5 users after the 20th user',
        { first: 5, after: encodeCursor({ id: 20 }) },
      ],
      ['returns the last 5 users', { last: 5 }],
      [
        'returns the last 5 users before the 1st user',
        { last: 5, before: encodeCursor({ id: 1 }) },
      ],
      [
        'returns the last 5 users before the 5th user',
        { last: 5, before: encodeCursor({ id: 5 }) },
      ],
      [
        'returns the last 5 users before the 6th user',
        { last: 5, before: encodeCursor({ id: 6 }) },
      ],
      [
        'returns the last 5 users before the 16th user',
        { last: 5, before: encodeCursor({ id: 16 }) },
      ],
    ]

    test.each(NUMBER_ID_VALID_CASES)('%s', async (name, connectionArgs) => {
      const result = await findManyCursorConnection<User, Pick<Prisma.UserWhereUniqueInput, 'id'>>(
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
  })

  describe('unique field', () => {
    beforeAll(async () => {
      await client.user.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== USER_FIXTURES.length; i++) {
        await client.user.create({ data: USER_FIXTURES[i] })
      }
    })

    it('returns all users with the base client (sanity check)', async () => {
      const result = await client.user.findMany({})
      expect(result).toEqual(USER_FIXTURES)
    })

    it('returns the paginated users with the base client (sanity check)', async () => {
      const result = await client.user.findMany({
        cursor: { email: 'user5@email.com' },
        take: 5,
        skip: 1,
      })
      expect(result).toMatchSnapshot()
    })

    const UNIQUE_FIELD_VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
      [
        'returns the first 5 users after the 1st user',
        { first: 5, after: encodeCursor({ email: 'user1@email.com' }) },
      ],
      [
        'returns the first 5 users after the 5th user',
        { first: 5, after: encodeCursor({ email: 'user5@email.com' }) },
      ],
      [
        'returns the first 5 users after the 15th user',
        { first: 5, after: encodeCursor({ email: 'user15@email.com' }) },
      ],
      [
        'returns the first 5 users after the 16th user',
        { first: 5, after: encodeCursor({ email: 'user16@email.com' }) },
      ],
      [
        'returns the first 5 users after the 20th user',
        { first: 5, after: encodeCursor({ email: 'user20@email.com' }) },
      ],
      [
        'returns the last 5 users before the 1st user',
        { last: 5, before: encodeCursor({ email: 'user1@email.com' }) },
      ],
      [
        'returns the last 5 users before the 5th user',
        { last: 5, before: encodeCursor({ email: 'user5@email.com' }) },
      ],
      [
        'returns the last 5 users before the 6th user',
        { last: 5, before: encodeCursor({ email: 'user6@email.com' }) },
      ],
      [
        'returns the last 5 users before the 16th user',
        { last: 5, before: encodeCursor({ email: 'user16@email.com' }) },
      ],
    ]

    test.each(UNIQUE_FIELD_VALID_CASES)('%s', async (name, connectionArgs) => {
      const result = await findManyCursorConnection<
        User,
        Pick<Prisma.UserWhereUniqueInput, 'email'>
      >(
        (args) => client.user.findMany(args),
        () => client.user.count(),
        connectionArgs,
        {
          getCursor: (node) => ({ email: node.email }),
          decodeCursor,
          encodeCursor,
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

    it('returns all profiles with the base client (sanity check)', async () => {
      const result = await client.profile.findMany({})
      expect(result).toEqual(PROFILE_FIXTURES)
    })

    it('returns the paginated profiles with the base client (sanity check)', async () => {
      const result = await client.profile.findMany({
        cursor: { firstname_lastname: { firstname: 'foo5', lastname: 'bar1' } },
        take: 5,
        skip: 1,
      })
      expect(result).toMatchSnapshot()
    })

    const MULTI_FIELD_ID_VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
      ['returns the first 5 profiles', { first: 5 }],
      [
        'returns the first 5 profiles after the 1st profile',
        {
          first: 5,
          after: encodeCursor({ firstname_lastname: { firstname: 'foo1', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the first 5 profiles after the 5th profile',
        {
          first: 5,
          after: encodeCursor({ firstname_lastname: { firstname: 'foo5', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the first 5 profiles after the 15th profile',
        {
          first: 5,
          after: encodeCursor({ firstname_lastname: { firstname: 'foo15', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the first 5 profiles after the 16th profile',
        {
          first: 5,
          after: encodeCursor({ firstname_lastname: { firstname: 'foo16', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the first 5 profiles after the 20th profile',
        {
          first: 5,
          after: encodeCursor({ firstname_lastname: { firstname: 'foo20', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the last 5 profiles before the 1st profile',
        {
          last: 5,
          before: encodeCursor({ firstname_lastname: { firstname: 'foo1', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the last 5 profiles before the 5th profile',
        {
          last: 5,
          before: encodeCursor({ firstname_lastname: { firstname: 'foo5', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the last 5 profiles before the 6th profile',
        {
          last: 5,
          before: encodeCursor({ firstname_lastname: { firstname: 'foo6', lastname: 'bar1' } }),
        },
      ],
      [
        'returns the last 5 profiles before the 16th profile',
        {
          last: 5,
          before: encodeCursor({ firstname_lastname: { firstname: 'foo16', lastname: 'bar1' } }),
        },
      ],
    ]

    test.each(MULTI_FIELD_ID_VALID_CASES)('%s', async (name, connectionArgs) => {
      const result = await findManyCursorConnection<
        Profile,
        Pick<Prisma.ProfileWhereUniqueInput, 'firstname_lastname'>
      >(
        (args) => client.profile.findMany(args),
        () => client.profile.count(),
        connectionArgs,
        {
          getCursor: (node) => ({
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

  describe('custom edge fields', () => {
    beforeAll(async () => {
      await client.todo.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== TODO_FIXTURES.length; i++) {
        await client.todo.create({ data: TODO_FIXTURES[i] })
      }
    })

    it('returns all todos with the base client (sanity check)', async () => {
      const result = await client.todo.findMany({})
      expect(result).toEqual(TODO_FIXTURES)
    })

    it('returns the paginated todos with the base client (sanity check)', async () => {
      const result = await client.todo.findMany({ cursor: { id: 'id_05' }, take: 5, skip: 1 })
      expect(result).toMatchSnapshot()
    })

    const VALID_CASES: Array<[string, ConnectionArguments | undefined]> = [
      ['returns all todos', undefined],
      ['returns the first 5 todos', { first: 5 }],
      ['returns the first 5 todos after the 1st todo', { first: 5, after: 'id_01' }],
      ['returns the first 5 todos after the 5th todo', { first: 5, after: 'id_05' }],
      ['returns the first 5 todos after the 15th todo', { first: 5, after: 'id_15' }],
      ['returns the first 5 todos after the 16th todo', { first: 5, after: 'id_16' }],
      ['returns the first 5 todos after the 20th todo', { first: 5, after: 'id_20' }],
      ['returns the last 5 todos', { last: 5 }],
      ['returns the last 5 todos before the 1st todo', { last: 5, before: 'id_01' }],
      ['returns the last 5 todos before the 5th todo', { last: 5, before: 'id_05' }],
      ['returns the last 5 todos before the 6th todo', { last: 5, before: 'id_06' }],
      ['returns the last 5 todos before the 16th todo', { last: 5, before: 'id_16' }],
    ]

    test.each(VALID_CASES)('%s', async (name, connectionArgs) => {
      const result = await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        connectionArgs,
        {
          modelToEdge: (model) => ({
            node: { ...model, extraNodeField: 'extra' },
            textLength: model.text.length
          }),
        }
      );

      expect(result).toMatchSnapshot()
    })

    test.each(VALID_CASES)('deprecated nodeToEdge field: %s', async (name, connectionArgs) => {
      const result = await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        connectionArgs,
        {
          nodeToEdge: (model) => ({
            node: { ...model, extraNodeField: 'extra' },
            textLength: model.text.length
          }),
        }
      );

      expect(result).toMatchSnapshot()
    })
  })

  describe('invalid arguments', () => {
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
  })
})
