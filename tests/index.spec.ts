import { Prisma, PrismaClient, Profile, Todo, User } from '@prisma/client'
import { GraphQLResolveInfo } from 'graphql'
import graphqlFields from 'graphql-fields'
import { mocked } from 'jest-mock'
import { ConnectionArguments, findManyCursorConnection } from '../src'
import { PROFILE_FIXTURES, TAG_FIXTURES, TODO_FIXTURES, USER_FIXTURES } from './fixtures'

function encodeCursor<Cursor>(prismaCursor: Cursor) {
  return Buffer.from(JSON.stringify(prismaCursor)).toString('base64')
}

function decodeCursor(cursor: string) {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('ascii'))
}

jest.mock('graphql-fields')

const mockGraphqlFields = mocked(graphqlFields)

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
      await client.tag.deleteMany({})
      await client.todo.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== TAG_FIXTURES.length; i++) {
        await client.tag.create({ data: TAG_FIXTURES[i] })
      }

      for (let i = 0; i !== TODO_FIXTURES.length; i++) {
        await client.todo.create({ data: TODO_FIXTURES[i] })
      }
    })

    test('returns all todos with the base client (sanity check)', async () => {
      const result = await client.todo.findMany({})
      expect(result).toEqual(TODO_FIXTURES)
    })

    test('returns the paginated todos with the base client (sanity check)', async () => {
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

    test('returns the first 5 filtered todos', async () => {
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

      // Test: Selected field
      result.edges[0].node.isCompleted

      // @ts-expect-error Test: Selected field typo
      result.edges[0].node.isCompletedd

      // @ts-expect-error Test: Not selected field
      result.edges[0].node.text

      // Test: Selected field
      result.nodes[0].isCompleted

      // @ts-expect-error Test: Selected field typo
      result.nodes[0].isCompletedd

      // @ts-expect-error Test: Not selected field
      result.nodes[0].text
    })

    test('returns the first 5 filtered todos (include)', async () => {
      const baseArgs = {
        include: { tag: true },
        where: { isCompleted: false },
      }

      const result = await findManyCursorConnection(
        (args) => client.todo.findMany({ ...args, ...baseArgs }),
        () => client.todo.count({ where: baseArgs.where }),
        { first: 5 }
      )

      expect(result).toMatchSnapshot()

      // Test: Included field
      result.edges[0].node.tag?.id

      // @ts-expect-error Test: Included field typo
      result.edges[0].node.tagg?.id

      // @ts-expect-error Test: Not included field
      result.edges[0].node.text?.id

      // Test: Included field
      result.nodes[0].tag?.id

      // @ts-expect-error Test: Included field typo
      result.nodes[0].tagg?.id

      // @ts-expect-error Test: Not included field
      result.nodes[0].text?.id
    })
  })

  describe('number id', () => {
    beforeAll(async () => {
      await client.tag.deleteMany({})
      await client.user.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== TAG_FIXTURES.length; i++) {
        await client.tag.create({ data: TAG_FIXTURES[i] })
      }

      for (let i = 0; i !== USER_FIXTURES.length; i++) {
        await client.user.create({ data: USER_FIXTURES[i] })
      }
    })

    test('returns all users with the base client (sanity check)', async () => {
      const result = await client.user.findMany({})
      expect(result).toEqual(USER_FIXTURES)
    })

    test('returns the paginated users with the base client (sanity check)', async () => {
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
      const result = await findManyCursorConnection(
        (args) => client.user.findMany(args),
        () => client.user.count(),
        connectionArgs,
        {
          getCursor: (record) => ({ id: record.id }),
          decodeCursor,
          encodeCursor,
        }
      )

      expect(result).toMatchSnapshot()
    })

    test('returns the first 5 filtered users', async () => {
      const baseArgs = {
        select: { id: true, email: true },
        where: { email: { contains: '@email' } },
      }

      const result = await findManyCursorConnection(
        (args) => client.user.findMany({ ...args, ...baseArgs }),
        () => client.user.count({ where: baseArgs.where }),
        { first: 5 }
      )

      expect(result).toMatchSnapshot()

      // Test: Selected field
      result.edges[0].node.email

      // @ts-expect-error Test: Selected field typo
      result.edges[0].node.emmail

      // @ts-expect-error Test: Not selected field
      result.edges[0].node.text

      // Test: Selected field
      result.nodes[0].email

      // @ts-expect-error Test: Selected field typo
      result.nodes[0].emmail

      // @ts-expect-error Test: Not selected field
      result.nodes[0].text
    })

    test('returns the first 5 filtered users (include)', async () => {
      const baseArgs = {
        include: { tag: true },
        where: { email: { contains: '@email' } },
      }

      const result = await findManyCursorConnection(
        (args) => client.user.findMany({ ...args, ...baseArgs }),
        () => client.user.count({ where: baseArgs.where }),
        { first: 5 }
      )

      expect(result).toMatchSnapshot()

      // Test: Included field
      result.edges[0].node.tag?.id

      // @ts-expect-error Test: Included field typo
      result.edges[0].node.tagg?.id

      // @ts-expect-error Test: Not included field
      result.edges[0].node.text?.id

      // Test: Included field
      result.nodes[0].tag?.id

      // @ts-expect-error Test: Included field typo
      result.nodes[0].tagg?.id

      // @ts-expect-error Test: Not included field
      result.nodes[0].text?.id
    })
  })

  describe('unique field', () => {
    beforeAll(async () => {
      await client.tag.deleteMany({})
      await client.user.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== TAG_FIXTURES.length; i++) {
        await client.tag.create({ data: TAG_FIXTURES[i] })
      }

      for (let i = 0; i !== USER_FIXTURES.length; i++) {
        await client.user.create({ data: USER_FIXTURES[i] })
      }
    })

    test('returns all users with the base client (sanity check)', async () => {
      const result = await client.user.findMany({})
      expect(result).toEqual(USER_FIXTURES)
    })

    test('returns the paginated users with the base client (sanity check)', async () => {
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
      const result = await findManyCursorConnection<User, { email: string }>(
        (args) => client.user.findMany(args),
        () => client.user.count(),
        connectionArgs,
        {
          getCursor: (record) => ({ email: record.email }),
          decodeCursor,
          encodeCursor,
        }
      )

      expect(result).toMatchSnapshot()
    })
  })

  describe('multi field id', () => {
    beforeAll(async () => {
      await client.tag.deleteMany({})
      await client.profile.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== TAG_FIXTURES.length; i++) {
        await client.tag.create({ data: TAG_FIXTURES[i] })
      }

      for (let i = 0; i !== PROFILE_FIXTURES.length; i++) {
        await client.profile.create({ data: PROFILE_FIXTURES[i] })
      }
    })

    test('returns all profiles with the base client (sanity check)', async () => {
      const result = await client.profile.findMany({})
      expect(result).toEqual(PROFILE_FIXTURES)
    })

    test('returns the paginated profiles with the base client (sanity check)', async () => {
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
          getCursor: (record) => ({
            firstname_lastname: {
              firstname: record.firstname,
              lastname: record.lastname,
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
      await client.tag.deleteMany({})
      await client.todo.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== TAG_FIXTURES.length; i++) {
        await client.tag.create({ data: TAG_FIXTURES[i] })
      }

      for (let i = 0; i !== TODO_FIXTURES.length; i++) {
        await client.todo.create({ data: TODO_FIXTURES[i] })
      }
    })

    test('returns all todos with the base client (sanity check)', async () => {
      const result = await client.todo.findMany({})
      expect(result).toEqual(TODO_FIXTURES)
    })

    test('returns the paginated todos with the base client (sanity check)', async () => {
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
      const result = await findManyCursorConnection<
        Todo,
        { id: string },
        Todo & { extraNodeField: string },
        { extraEdgeField: string; cursor: string; node: Todo & { extraNodeField: string } }
      >(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        connectionArgs,
        {
          recordToEdge: (record) => ({
            node: { ...record, extraNodeField: 'Foo' },
            extraEdgeField: 'Bar',
          }),
        }
      )

      expect(result).toMatchSnapshot()

      // Test that the node.extraNodeField return types work via TS
      result.edges[0]?.node.extraNodeField

      // Test that the extraEdgeField return type work via TS
      result.edges[0]?.extraEdgeField

      // Test that the node.extraNodeField return types work via TS
      result.nodes[0]?.extraNodeField
    })
  })

  describe('requested fields via resolveInfo', () => {
    beforeAll(async () => {
      await client.tag.deleteMany({})
      await client.todo.deleteMany({})

      // Build up the fixtures sequentially so they are in a consistent order
      for (let i = 0; i !== TAG_FIXTURES.length; i++) {
        await client.tag.create({ data: TAG_FIXTURES[i] })
      }

      for (let i = 0; i !== TODO_FIXTURES.length; i++) {
        await client.todo.create({ data: TODO_FIXTURES[i] })
      }
    })

    test('returns all todos with the base client (sanity check)', async () => {
      const result = await client.todo.findMany({})
      expect(result).toEqual(TODO_FIXTURES)
    })

    test('returns the paginated todos with the base client (sanity check)', async () => {
      const result = await client.todo.findMany({ cursor: { id: 'id_05' }, take: 5, skip: 1 })
      expect(result).toMatchSnapshot()
    })

    const VALID_CASES: Array<[string, ConnectionArguments | undefined, Record<string, unknown>]> = [
      ['returns all todos (no fields)', undefined, {}],
      ['returns all todos (edges field)', undefined, { edges: { node: { id: 1 } } }],
      ['returns all todos (nodes field)', undefined, { nodes: { id: 1 } }],
      ['returns all todos (totalCount field)', undefined, { totalCount: 1 }],
      ['returns the first 5 todos (no fields)', { first: 5 }, {}],
      ['returns the first 5 todos (totalCount field)', { first: 5 }, { totalCount: 1 }],
      ['returns the last 5 todos (no fields)', { last: 5 }, {}],
      ['returns the last 5 todos (totalCount field)', { last: 5 }, { totalCount: 1 }],
    ]

    test.each(VALID_CASES)('%s', async (name, connectionArgs, mockFields) => {
      mockGraphqlFields.mockReturnValue(mockFields)

      const result = await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        connectionArgs,
        { resolveInfo: { some: 'fake', data: 'here' } as unknown as GraphQLResolveInfo }
      )

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

// These are not real tests which run, but rather a way to ensure that the types are correct
// when tsc runs
const typecheckForInferredTypes = async () => {
  let client: PrismaClient
    // Default will get the inferred types from prisma
  ;(await findManyCursorConnection(
    (args) => client.todo.findMany(args),
    () => client.todo.count(),
    {}
  )) satisfies {
    edges: { cursor: string; node: { id: string; text: string; isCompleted: boolean } }[]
  }

  // Handles edge type additions
  ;(await findManyCursorConnection(
    (args) => client.todo.findMany(args),
    () => client.todo.count(),
    {},
    {
      recordToEdge: (record) => ({ node: record, extraEdgeField: 'Bar' }),
    }
  )) satisfies {
    edges: {
      cursor: string
      node: { id: string; text: string; isCompleted: boolean; tagId: string | null }
      extraEdgeField: string
    }[]
  }

  // Handles edge type additions
  ;(await findManyCursorConnection(
    (args) => client.todo.findMany(args),
    () => client.todo.count(),
    {},
    {
      recordToEdge: (record) => ({
        node: { ...record, extraNodeField: 'a' },
      }),
    }
  )) satisfies {
    edges: {
      cursor: string
      node: {
        id: string
        text: string
        isCompleted: boolean
        extraNodeField: string
        tagId: string | null
      }
    }[]
  }
}

typecheckForInferredTypes
