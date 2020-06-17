import { PrismaClient } from '@prisma/client'
import { findManyCursorConnection } from '../src'
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

  it('returns all TODOs', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { first: 20 }
    )

    expect(result.pageInfo).toMatchSnapshot()
    expect(result.edges.map((edge) => edge.node)).toEqual(TODO_FIXTURES)
  })

  it('returns the first 5 TODOs', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { first: 5 }
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

  it('returns the first 5 TODOs after the 5th todo', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { first: 5, after: 'id_05' }
    )

    expect(result).toMatchSnapshot()
  })

  it('returns the first 5 TODOs after the 15th todo', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { first: 5, after: 'id_15' }
    )

    expect(result).toMatchSnapshot()
  })

  it('returns the first 5 TODOs after the 16th todo', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { first: 5, after: 'id_16' }
    )

    expect(result).toMatchSnapshot()
  })

  it('returns the first 5 TODOs after the 20th todo', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { first: 5, after: 'id_20' }
    )

    expect(result).toMatchSnapshot()
  })

  it('returns the last 5 TODOs', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { last: 5 }
    )

    expect(result).toMatchSnapshot()
  })

  it('returns the last 5 TODOs before the 5th todo', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { last: 5, before: 'id_05' }
    )

    expect(result).toMatchSnapshot()
  })

  it('returns the last 5 TODOs before the 6th todo', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { last: 5, before: 'id_06' }
    )

    expect(result).toMatchSnapshot()
  })

  it('returns the last 5 TODOs before the 16th todo', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { last: 5, before: 'id_16' }
    )

    expect(result).toMatchSnapshot()
  })

  it('returns the last 5 TODOs before the 1st todo', async () => {
    const result = await findManyCursorConnection(
      (args) => client.todo.findMany(args),
      () => client.todo.count(),
      { last: 5, before: 'id_01' }
    )

    expect(result).toMatchSnapshot()
  })

  it('errors for invalid arguments (negative first)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        { first: -5 }
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })

  it('errors for invalid arguments (negative last)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        { last: -5 }
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })

  it('errors for invalid arguments (no first & no last)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        {}
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })

  it('errors for invalid arguments (both first & last)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        { first: 5, last: 5 }
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })

  it('errors for invalid arguments (both after & before)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        { after: 'id_05', before: 'id_15' }
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })

  it('errors for invalid arguments (both after & before with first)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        { first: 5, after: 'id_05', before: 'id_15' }
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })

  it('errors for invalid arguments (after without first)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        { after: 'id_05' }
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })

  it('errors for invalid arguments (before without last)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        { before: 'id_15' }
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })

  it('errors for invalid arguments (after with last)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        { last: 5, after: 'id_05' }
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })

  it('errors for invalid arguments (before with first)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        { first: 5, before: 'id_15' }
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })

  it('errors for invalid arguments (kitchensink)', async () => {
    let error

    try {
      await findManyCursorConnection(
        (args) => client.todo.findMany(args),
        () => client.todo.count(),
        { first: 5, after: 'id_05', last: 5, before: 'id_15' }
      )
    } catch (err) {
      error = err
    }

    expect(error).toMatchSnapshot()
  })
})
