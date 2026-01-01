const express= require('express')
const router= express.Router()
const FIRST= require('../controllers/1st.controller')
const catchAsync = require('../utils/catchAsync.utils')


router.get('/', catchAsync(FIRST.renderHomePage))



router.get('/video/info', catchAsync(FIRST.getApiVideoInfo))

router.get('/video/download', catchAsync(FIRST.getAPiDownloadVideo ))



module.exports= router
