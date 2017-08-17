export default {
  type: 1, // 1 自有应用 2 开放应用
  ak: '', // 应用ID
  sk: '', // 应用秘钥
}

export const open = {
  redirect_uri: 'http://b2c3217a.ngrok.io/code', // 开放型应用才需要这个
  state: 'test', // 开放型应用才需要这个
}

export const personal = {
  machine_code: '', // 终端号
  msign: '', // 终端密钥
}
