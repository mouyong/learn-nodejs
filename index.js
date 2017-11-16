import { request, logger as log, uuid } from './utils'
import { genSign } from './helpers'

import path from 'path'
import { writeFileSync } from 'fs'

import config, { open } from './config/app'
import urls from './config/apiurl'

import Koa from 'koa'
import serve from 'koa-static'
import qs from 'querystring'
import Redis from 'ioredis'
import superagent from 'superagent'
const router = require('koa-router')()

const redis = new Redis()

let data     = {}
data.client_id = config.ak // 应用 ID

const app = new Koa()

const main = serve(path.join(__dirname, 'views'))

let option = {flag: 'a+'}

const authorized = (ctx, next) => {
  data = {
    ...data,
    ...open,
    response_type: 'code',
  }

  ctx.redirect(`${urls.base}${urls.authorize}?${qs.stringify(data)}`)
}

const parseCode = (ctx, next) => {
  writeFileSync('./log', ctx.query.code + '\n', {flag: 'a+'})
  redis.pipeline()
    .set('code', ctx.query.code, 'EX', 600)
    .exec()

  ctx.redirect('/access.token')
}

const getRequestData = (obj) => {
  return genSign({...data, ...obj})
}

const AccessToken = async (ctx, next) => {
  const code = await redis.get('code') || null
  const accessToken = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  if (accessToken && null == code && machine_code) {
    return next()
  }

  if (null == code) {
    return authorized(ctx, next)
  }

  request(`${urls.base}${urls.accessToken}`, getRequestData({
    code,
    'grant_type': 'authorization_code',
  }), function (err, res) {
    if (err || !res.ok) {
      let info = log(err)
      writeFileSync('./log', info, option);
    } else {
      if (res.body.error == 0) {
        // 存储 access token   refresh token
        writeFileSync('./log', res.text + '\n', option)
        redis.pipeline()
          .set('token:access', res.body.body.access_token)
          .set('token:refresh', res.body.body.refresh_token)
          .set('token:machine_code', res.body.body.machine_code)
          .del('code')
          .exec()
      }
    }
  })
  next()
}

const RefreshToken = async (ctx, next) => {
  const refresh_token =  await redis.get('token:refresh')
  request(`${urls.base}${urls.refreshToken}`, getRequestData({
    'grant_type': 'refresh_token',
    refresh_token,
  }), (err, res) => {
    if (err || !res.ok) {
      let info = log(err)
      writeFileSync('./log', info, option);
    } else {
      if (res.body.error == 0) {
        // 存储 access token   refresh token
        writeFileSync('./log', res.text + '\n', option)
        redis.pipeline()
          .set('token:access', res.body.body.access_token)
          .set('token:refresh', res.body.body.refresh_token)
          .set('token:machine_code', res.body.body.machine_code)
          .exec()
      }
    }
  })
  next()
}

const DelMachineAuth = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  if (null == access_token || access_token == '' || machine_code == '') {
    ctx.throw(404, 'access token Not Found')
  }

  request(`${urls.base}${urls.delMachineAuth}`, getRequestData({
    access_token,
    machine_code,
  }))

  ctx.body = '<a href="/">返回 index</a>'
}

const MenuCreate = async (ctx, next) => {
  const access_token = await redis.get('token:access')
  const machine_code = await redis.get('token:machine_code')

  if (null == access_token || access_token == '') {
    ctx.throw(404, 'access token Not Found')
  }
  // let content = `["测5试", "${encodeURI('http://test')}"]`
  let content = new Array(`${encodeURIComponent('测5试')}`, `${encodeURIComponent('http://test')}`)
  img_url='http://www.hilw.cn/X15.png'

  // data = `${genSign({...data, access_token, machine_code})}&content=${content}`
  data = `${genSign({...data, access_token, machine_code, content})}`

  let url = `${urls.base}${urls.menuCreate}`

  request(url, data)

  next()
}

// operate 1. shutdown 2. restart
const ShatdownOrRestart = async (ctx, next, operate = 'restart') => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null


  if (null == access_token || access_token == '') {
    ctx.throw(404, 'access token Not Found')
  }
  let tmpData = {...data, access_token, machine_code, response_type: operate}

  let url = `${urls.base}${urls.shutdownRestart}`
  request(url, getRequestData(tmpData))
}

const Shutdown = (ctx, next) => {
  ShatdownOrRestart(ctx, next, 'shutdown')
  next()
}

const Restart = (ctx, next) => {
  ShatdownOrRestart(ctx, next, 'restart')
  next()
}

const Voice = async (ctx, next, voiceNum = 2, voiceType = 'horn') => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  data = {
    ...data, access_token, machine_code,
    voice: voiceNum,
    response_type: voiceType,
  }

  let url = `${urls.base}${urls.voice}`
  request(url, getRequestData(data))
}

const VoiceType = (ctx, next) => {
  Voice(ctx, next, 2, 'buzzer') // 默认会将声音大小设置为 2
  next()
}

const VoiceNum = (ctx, next) => {
  Voice(ctx, next, 1, 'horn') // 默认会将声音类型为 horn
  next()
}

const printIndex = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  let content = '123'
  let origin_id = uuid()


  data = {
    ...data, access_token, machine_code,
    origin_id,
    content,
  }

  let url = `${urls.base}${urls.printIndex}`
  request(url, getRequestData(data))
  next()
}

const printInfo = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  data = {
    ...data, access_token, machine_code,
  }

  let url = `${urls.base}${urls.printInfo}`
  request(url, getRequestData(data))
  next()
}

const Version = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  data = {
    ...data, access_token, machine_code
  }

  let url = `${urls.base}${urls.version}`
  request(url, getRequestData(data))
  next()
}

const cancelAllPrint = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  data = {
    ...data, access_token, machine_code
  }

  let url = `${urls.base}${urls.cancelAllPrint}`
  request(url, getRequestData(data))
  next()
}

const cancelOnePrint = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  let order_id = 123
  data = {
    ...data, access_token, machine_code, order_id
  }

  let url = `${urls.base}${urls.cancelOnePrint}`
  request(url, getRequestData(data))
  next()
}

const setLogo = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  // 百度
  let img_url = 'http://touxiang.qqzhi.com/uploads/2012-11/1111020331193.jpg'

  data = {
    ...data, access_token, machine_code, img_url
  }

  let url = `${urls.base}${urls.setLogo}`
  request(url, getRequestData(data))
  next()
}

const removeLogo = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  data = {
    ...data, access_token, machine_code
  }

  let url = `${urls.base}${urls.removeLogo}`
  request(url, getRequestData(data))
  next()
}

const Order = async (ctx, next, response_type = 'open') => {
  const access_token = await redis.get('token:access') || null
  const machine_code = await redis.get('token:machine_code') || null

  data = {
    ...data, access_token, machine_code, response_type
  }

  let url = `${urls.base}${urls.order}`
  request(url, getRequestData(data))
  next()
}

const OrderClose = (ctx, next) => {
  Order(ctx, next, 'close')
}

router.get('/', main)
  .get('/authorize', authorized)
  .get('/code', parseCode)
  .get('/access.token', AccessToken)
  .get('/del.machine.auth', DelMachineAuth)
  .get('/refresh.token', RefreshToken)
  .get('/menu.create', MenuCreate)
  .get('/machine.shutdown', Shutdown)
  .get('/machine.restart', Restart)
  .get('/voice.type', VoiceType)
  .get('/voice.num', VoiceNum)
  .get('/print.index', printIndex)
  .get('/print.info', printInfo)
  .get('/version', Version)
  .get('/cancel.print.all', cancelAllPrint)
  .get('/cancel.print', cancelOnePrint)
  .get('/logo.create', setLogo)
  .get('/logo.remove', removeLogo)
  .get('/order.open', Order)
  .get('/order.close', OrderClose)

app.on('error', (err) => {
  let option = {flag: 'a+'}
  let info = log(err)
  writeFileSync('./err', info, option);
})

const handler = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.response.status = err.statusCode || err.status || 500;
    ctx.response.type = 'html';
    ctx.response.body = `<h1>${err.name}, ${err.message}. <a href="/">back to index</a></h1>`;
    ctx.app.emit('error', err, ctx);
  }
};

app.use(handler)
  .use(main)
  .use(router.routes())
  .use(async (ctx, next) => {
    ctx.redirect('/')
  })

app.listen(3001)
