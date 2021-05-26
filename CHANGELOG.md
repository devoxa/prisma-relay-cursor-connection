# 2.0.1

**Bugfixes**

- Fix the types for custom nodes (Thanks to @ahmetuysal)

# 2.0.0

**Features**

- **BREAKING** Add the ability to define custom nodes (Thanks to @ahmetuysal)
  - The option `nodeToEdge` is now called `recordToEdge`
  - The interface `Options<Record, Cursor, CustomEdge extends Edge<Record>>` is now
    `Options<Record, Cursor, Node, CustomEdge extends Edge<Node>>`

# 1.2.0

**Features**

- Add the ability to define custom edges (Thanks to @ahmetuysal)

# 1.1.0

**Features**

- Add the ability to work with custom cursors & handle encoding/decoding cursors (Thanks to
  @jeongsd)

# 1.0.1

**Bugfixes**

- Fix not being able to use the module without passing `args`

# 1.0.0

Initial release
