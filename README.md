<!-- Title -->
<h1 align="center">
  prisma-relay-cursor-connection
</h1>

<!-- Description -->
<h4 align="center">
  Extend <a href="https://www.prisma.io/">Prisma's</a> <code>findMany</code> method to support <a href="https://relay.dev/graphql/connections.htm">Relay Cursor Connections</a>
</h4>

<!-- Badges -->
<p align="center">
  <a href="https://www.npmjs.com/package/@devoxa/prisma-relay-cursor-connection">
    <img
      src="https://img.shields.io/npm/v/@devoxa/prisma-relay-cursor-connection?style=flat-square"
      alt="Package Version"
    />
  </a>

  <a href="https://github.com/devoxa/prisma-relay-cursor-connection/actions?query=branch%3Amaster+workflow%3A%22Continuous+Integration%22">
    <img
      src="https://img.shields.io/github/workflow/status/devoxa/prisma-relay-cursor-connection/Continuous%20Integration?style=flat-square"
      alt="Build Status"
    />
  </a>

  <a href="https://codecov.io/github/devoxa/prisma-relay-cursor-connection">
    <img
      src="https://img.shields.io/codecov/c/github/devoxa/prisma-relay-cursor-connection/master?style=flat-square"
      alt="Code Coverage"
    />
  </a>
</p>

<!-- Quicklinks -->
<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#contributors">Contributors</a> •
  <a href="#license">License</a>
</p>

<br>

## Installation

```bash
yarn add @devoxa/prisma-relay-cursor-connection
```

This module has a peer dependency on `@prisma/client` version `^2.0.0 || ^3.0.0`.

## Usage

### General Usage

This module validates the connection arguments to make sure they work with Prisma. The following
combinations are supported:

- `{}` All resources
- `{ first: number }` The first X resources
- `{ first: number, after: string }` The first X resources after the id Y
- `{ last: number }` The last X resources
- `{ last: number, before: string }` The last X resources before the id Y

Two cases need to be checked in your code if you are passing in user-provided data to prevent the
user from reading out too many resources at once:

- One of `first` | `last` has to be defined
- `first` | `last` have to be below a reasonable maximum (e.g. 100)

```ts
import {
  findManyCursorConnection,
  ConnectionArguments,
} from '@devoxa/prisma-relay-cursor-connection'

const result = await findManyCursorConnection(
  (args) => client.todo.findMany(args),
  () => client.todo.count(),
  { first: 5, after: '5c11e0fa-fd6b-44ee-9016-0809ee2f2b9a' } // typeof ConnectionArguments
)
```

### Type-Safe Arguments

You can also use additional `FindManyArgs` while keeping type safety intact:

```ts
import { findManyCursorConnection } from '@devoxa/prisma-relay-cursor-connection'

const baseArgs = {
  select: { id: true, isCompleted: true },
  where: { isCompleted: true },
}

const result = await findManyCursorConnection(
  (args) => client.todo.findMany({ ...args, ...baseArgs }),
  () => client.todo.count({ where: baseArgs.where }),
  { last: 5, before: '5c11e0fa-fd6b-44ee-9016-0809ee2f2b9a' }
)

// Type error: Property text does not exist
result.edges[0].node.text
```

### Custom Cursors

By default, the cursor is the `id` field of your model. If you would like to use a different field,
a compound index, or handle encoding/decoding, you can pass the following options:

```ts
import { findManyCursorConnection } from '@devoxa/prisma-relay-cursor-connection'

const result = await findManyCursorConnection(
  (args) => client.todo.findMany(args),
  () => client.todo.count(),
  { first: 5, after: 'eyJpZCI6MTZ9' },
  {
    getCursor: (record) => ({ id: record.id }),
    encodeCursor: (cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64'),
    decodeCursor: (cursor) => JSON.parse(Buffer.from(cursor, 'base64').toString('ascii')),
  }
)
```

You can find more examples for custom cursors in the [unit tests](./tests/index.spec.ts).

### Custom Edges & Nodes

By default, the edge consists of the `cursor` and the `node`. If you would like to add additional
fields to the edge or the node, you can pass the following option:

```ts
import { findManyCursorConnection } from '@devoxa/prisma-relay-cursor-connection'

const result = await findManyCursorConnection<
  Todo,
  { id: string },
  Todo & { extraNodeField: string },
  { extraEdgeField: string; cursor: string; node: Todo & { extraNodeField: string } }
>(
  (args) => client.todo.findMany(args),
  () => client.todo.count(),
  { first: 5, after: 'eyJpZCI6MTZ9' },
  {
    recordToEdge: (record) => ({
      node: { ...record, extraNodeField: 'Foo' },
      extraEdgeField: 'Bar',
    }),
  }
)
```

### Resolve information

You can pass GraphQL resolve information into the options to automatically remove extra Prisma
queries for fields that are not present in your GraphQL query. This is mainly useful if you are not
using `totalCount` for your pagination logic or you only want to query `totalCount` without any
edges.

```ts
import { findManyCursorConnection } from '@devoxa/prisma-relay-cursor-connection'
import { GraphQLResolveInfo } from 'graphql'

const resolveInfo: GraphQLResolveInfo = {
  // ...
}

const result = await findManyCursorConnection(
  (args) => client.todo.findMany(args),
  () => client.todo.count(),
  { first: 5, after: '5c11e0fa-fd6b-44ee-9016-0809ee2f2b9a' },
  { resolveInfo }
)
```

## Contributing

```bash
# Setup the test database
yarn prisma migrate dev --preview-feature

# Run the tests
yarn test
```

## Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://www.david-reess.de"><img src="https://avatars3.githubusercontent.com/u/4615516?v=4?s=75" width="75px;" alt=""/><br /><sub><b>David Reeß</b></sub></a><br /><a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=queicherius" title="Code">💻</a> <a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=queicherius" title="Documentation">📖</a> <a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=queicherius" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://twitter.com/controlplusb"><img src="https://avatars2.githubusercontent.com/u/12164768?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Sean Matheson</b></sub></a><br /><a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=ctrlplusb" title="Code">💻</a> <a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=ctrlplusb" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://marcjulian.de/?ref=github"><img src="https://avatars1.githubusercontent.com/u/8985933?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Marc</b></sub></a><br /><a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=marcjulian" title="Code">💻</a></td>
    <td align="center"><a href="http://jeongsd.dev"><img src="https://avatars1.githubusercontent.com/u/7903426?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Jeong Seong Dae</b></sub></a><br /><a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=jeongsd" title="Code">💻</a> <a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=jeongsd" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://github.com/ahmetuysal"><img src="https://avatars.githubusercontent.com/u/26417668?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Ahmet Uysal</b></sub></a><br /><a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=ahmetuysal" title="Code">💻</a> <a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=ahmetuysal" title="Tests">⚠️</a></td>
    <td align="center"><a href="https://github.com/nicksrandall"><img src="https://avatars.githubusercontent.com/u/1800460?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Nick Randall</b></sub></a><br /><a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=nicksrandall" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/igo"><img src="https://avatars.githubusercontent.com/u/55597?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Igor Urminček</b></sub></a><br /><a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=igo" title="Documentation">📖</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/TheAschr"><img src="https://avatars.githubusercontent.com/u/10580515?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Alex Schrimpf</b></sub></a><br /><a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=TheAschr" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/marinarierav"><img src="https://avatars.githubusercontent.com/u/47626039?v=4?s=75" width="75px;" alt=""/><br /><sub><b>Marina Riera</b></sub></a><br /><a href="https://github.com/devoxa/prisma-relay-cursor-connection/commits?author=marinarierav" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors)
specification. Contributions of any kind welcome!

## License

MIT
