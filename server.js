'use strict'

const http = require('http')
const app = require('./app')

const PORT = 10000

process.on('uncaughtException', err => {
  console.error('Uncaught Exception', err)
  process.exit(1)
})

process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection', err)
  process.exit(1)
})

const server = http.createServer(app)

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})

const shutdown = signal => {
  console.log(`Received ${signal}. Shutting down...`)

  server.close(() => {
    process.exit(0)
  })

  setTimeout(() => {
    console.error('Force shutdown')
    process.exit(1)
  }, 10000).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
