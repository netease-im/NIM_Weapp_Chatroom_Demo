//index.js
const auth = require('../../utils/auth.js')

//获取应用实例
const app = getApp()

Page({
  data: {
    canIUse: wx.canIUse('button.open-type.getUserInfo')
  },
  onLoad() {
    let userInfo = null
    try {
      userInfo = wx.getStorageSync('userInfo')
    } catch (error) {
      console.log(error)
    }
    if (userInfo) {
      app.globalData.userInfo = userInfo
      console.log('auto login ...')
      wx.redirectTo({
        url: '/pages/home/home'
      })
    }
  },
  getUserInfo(event) {
    const { detail } = event
    const {userInfo} = detail
    detail.sessionKey = app.globalData.sessionKey
    console.log(app.globalData.sessionKey)
    auth.wxUploadUserInfo(detail).then(() => {
      wx.setStorage({
        key: "userInfo",
        data: userInfo,
        success: function() {
          app.globalData.userInfo = userInfo
          wx.redirectTo({
            url: '/pages/home/home'
          })
        }
      })
    })
  }
})
