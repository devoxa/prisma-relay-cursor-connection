const { PrismaClient } = require('@prisma/client')
const { TODO_FIXTURES } = require('../dist/tests/fixtures')
client = new PrismaClient()
// client.todo.deleteMany({}).then(() => {
    
    for (let i = 0; i !== TODO_FIXTURES.length; i++) {
      const id = i < 9 ? `0${i + 1}` : i + 1
      const cidVersion = { ...TODO_FIXTURES[i], id: `cid_${id}` }
      client.todo.create({ data: cidVersion })
      console.log("creates")
    }

// })
