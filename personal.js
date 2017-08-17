import { request, logger as log, uuid } from './utils'
import { genSign } from './helpers'

import path from 'path'
import { writeFileSync } from 'fs'

import config, { personal } from './config/app'
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
let machine_code = personal.machine_code // 终端号
let msign = personal.msign // 终端密钥

let machineInfo = {
    machine_code,
    msign,
  }

const app = new Koa()

const main = serve(path.join(__dirname, 'views'))

let option = {flag: 'a+'}

const getRequestData = (obj) => {
  return genSign({...data, ...obj})
}

const AccessToken = async (ctx, next) => {
  const accessToken = await redis.get('token:access') || null

  if (accessToken) {
    return next()
  }

  let data = getRequestData({
    'grant_type': 'client_credentials',
  })

  request(`${urls.base}${urls.accessToken}`, data, function (err, res) {
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
  const access_token = await redis.get('token:access')

  if (null == access_token || access_token == '') {
    ctx.throw(404, 'access token Not Found')
  }

  request(`${urls.base}${urls.delMachineAuth}`, getRequestData({
    access_token,
    ...machineInfo,
  }))

  ctx.body = '<a href="/">返回 index</a>'
}

const MenuCreate = async (ctx, next) => {
  const access_token = await redis.get('token:access')

  if (null == access_token || access_token == '') {
    ctx.throw(404, 'access token Not Found')
  }
  let content = `["测5试", "${encodeURI('http://test')}"]`

  data = `${genSign({...data, access_token, machine_code})}&content=${content}`

  let url = `${urls.base}${urls.menuCreate}`

  request(url, data)

  next()
}

const AddMachineAuth = async (ctx, next) => {
  const access_token = await redis.get('token:access')

  if (null == access_token || access_token == '') {
    ctx.throw(404, 'access token Not Found')
  }

  request(`${urls.base}${urls.addMachineAuth}`, getRequestData({
    access_token,
    ...machineInfo,
  }))

  ctx.body = '<a href="/">返回 index</a>'
}

// operate 1. shutdown 2. restart
const ShatdownOrRestart = async (ctx, next, operate = 'restart') => {
  const access_token = await redis.get('token:access') || null

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

  data = {
    ...data, access_token, machine_code,
  }

  let url = `${urls.base}${urls.printInfo}`
  request(url, getRequestData(data))
  next()
}

const Version = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null

  data = {
    ...data, access_token, machine_code
  }

  let url = `${urls.base}${urls.version}`
  request(url, getRequestData(data))
  next()
}

const cancelAllPrint = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null

  data = {
    ...data, access_token, machine_code
  }

  let url = `${urls.base}${urls.cancelAllPrint}`
  request(url, getRequestData(data))
  next()
}

const cancelOnePrint = async (ctx, next) => {
  const access_token = await redis.get('token:access') || null

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

  data = {
    ...data, access_token, machine_code
  }

  let url = `${urls.base}${urls.removeLogo}`
  request(url, getRequestData(data))
  next()
}

const Order = async (ctx, next, response_type = 'open') => {
  const access_token = await redis.get('token:access') || null

  data = {
    ...data, access_token, machine_code, response_type
  }

  let url = `${urls.base}${urls.order}`
  request(url, getRequestData(data))
}

const OrderOpen = (ctx, next) => {
  Order(ctx, next, 'open')
  next()
}

const OrderClose = (ctx, next) => {
  Order(ctx, next, 'close')
  next()
}

const BtnPrint = async (ctx, next, response_type = 'btnopen') => {
  const access_token = await redis.get('token:access') || null

  data = {
    ...data, access_token, machine_code, response_type
  }

  let url = `${urls.base}${urls.btnPrint}`
  request(url, getRequestData(data))
}

const BtnPrintOpen = (ctx, next) => {
  BtnPrint(ctx, next, 'btnopen')
  next()
}

const BtnPrintClose = (ctx, next) => {
  BtnPrint(ctx, next, 'btnclose')
  next()
}

router.get('/', main)
  .get('/access.token', AccessToken)
  .get('/add.machine.auth', AddMachineAuth)
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
  .get('/order.open', OrderOpen)
  .get('/order.close', OrderClose)
  .get('/print.btn.open', BtnPrintOpen)
  .get('/print.btn.close', BtnPrintClose)

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

app.listen(3000)
