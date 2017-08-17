import fs, { writeFileSync } from 'fs'
import moment from 'moment'
import Uuid from 'node-uuid'
import superagent from 'superagent'

export function uuid() {
  return Uuid.v4()
}

export function time() {
  return moment().format('X')
}

export function date(format = 'YYYY-MM-DD HH:mm:ss') {
  return moment().format(format)
}

export function logger(err) {
  let info = date() + ' > '
  if (err instanceof Error) {
    info += `${err.name}: ${err.message}`
  } else {
    info += err
  }

  info += ' \n'
  process.stdout.write(info)
  return info
}

export function request(url, data, callback = null) {
  if (null == callback) {
    const option = {flag: 'a+'}
    callback = (err, res) => {
      if (err || !res.ok) {
        let info = logger(err)
        writeFileSync('./log', info, option);
      } else {
        logger(res.text)
        writeFileSync('./log', res.text + '\n', option)
      }
    }
  }
  superagent.post(url)
    .send(data)
    .timeout({
      response: 10000,
      deadline: 60000,
    })
    .end(callback)
}
