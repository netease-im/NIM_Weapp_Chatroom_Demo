const demoServer = 'https://yunxin.163.com/weixin'

const wxGetSession = (code) => new Promise((resolve, reject) => {
  wx.request({
    url: `${demoServer}/wxlogin`,
    header: {
      'content-type': 'application/json;charset=utf-8'
    },
    method: 'POST',
    data: {
      code,
    },
    success({ data, statusCode }) {
      if (statusCode === 200) {
        resolve(data)
      } else {
        reject(data)
      }
    },
    fail(error) {
      reject(error)
    }
  })
})

const wxLogin = () => new Promise((resolve, reject) => {
  wx.login({
    success(res) {
      if (res.code) {
        wxGetSession(res.code).then(data => {
          resolve(data)
        }).catch(error => {
          reject(error)
        })
      } else {
        reject(res)
      }
    },
    fail(error) {
      reject(error)
    }
  })
})

const wxUploadUserInfo = (options) => new Promise((resolve, reject) => {
  const { encryptedData, iv, signature, sessionKey } = options
  wx.request({
    url: `${demoServer}/wxuinfo`,
    header: {
      'content-type': 'application/json;charset=utf-8'
    },
    method: 'POST',
    data: {
      encryptedData,
      iv,
      signature,
      sessionKey,
    },
    success({ data, statusCode }) {
      if (statusCode === 200) {
        resolve(data)
      } else {
        reject(data)
      }
    },
    fail(error) {
      reject(error)
    }
  })
})

module.exports = {
  wxLogin,
  wxUploadUserInfo,
}
