import qs from 'querystring'
import utility from 'utility'

import { time, uuid } from './utils'

import config from './config/app'

export function singnature(time) {
  let sign = config.ak + time + config.sk
  return utility.md5(sign)
}

export function genSign(data) {
  let t = time()
  let obj = {
    'scope': 'all',
    'sign': singnature(t),
    'id': uuid(),
    'timestamp': t
  }
  return qs.stringify({...obj, ...data})
}

