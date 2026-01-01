'use strict'

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const morgan = require('morgan')
const http = require('http')
const FIRST_ROUTES= require('./routes/1st.routes')


const app = express()

process.on('uncaughtException', err => {
  console.error('Uncaught Exception', err)
  process.exit(1)
})

process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection', err)
  process.exit(1)
})

app.disable('x-powered-by')

app.use(helmet({ contentSecurityPolicy: false }))

const ALLOWED_ORIGINS = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://15.206.115.26:10000'
]
  
app.use(cors({
origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) {
    return cb(null, true);
    }
    return cb(new Error('CORS not allowed'), false);
},
methods: ['GET']
}))
  


app.use(express.json({ limit: '1kb' }))
app.use(express.urlencoded({ extended: false }))


app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
}))


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use('/', FIRST_ROUTES)

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' })
})


app.use((err, req, res, next) => {
    console.error(err)
    const status = err.status || 500
    const message = status === 500 ? 'Internal Server Error' : err.message

    const response = { success: false, message, status }
  
    if (res.headersSent) return next(err)
  
    res.status(status).json(response)
})
  


module.exports = app
