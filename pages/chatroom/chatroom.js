import Chatroom from '../../vendor/NIM_Web_Chatroom_v5.4.0.js'
import * as iconBase64Map from '../../utils/imageBase64.js'
import { formatTime, generateRichTextNode, generateImageNode, generateFingerGuessImageFile } from '../../utils/util.js'
let app = getApp()
Page({
  data: {
    defaultAvatar: '', //用户默认头像
    currentTab: 0,//顶部当前索引
    roomInfo: {}, // 房间信息 {announcement, broadcasturl, createtime，creator，ext，name，onlineusercount，roomid，status}
    ownerInfo: {}, // 主播信息 {account, avatar,blacked,chatroomId,custom,gaged,nick,online,tempMuted,tempMuteDuration,type,updateTime,valid}
    onlineMember: [], // 在线成员 [{account,avatar,nick,type}]
    iconBase64Map: {}, // base64 icon
    inputValue: '', // 发送的文本内容
    focusFlag: false,//控制输入框失去焦点与否
    emojiFlag: false,//emoji键盘标志位
    moreFlag: false, // 更多功能标志
    messageArr: [], // 渲染的数据
    accountMap: {}, // 存储了账号map，目的是账号去重
    animation: null,
    scrollTop: 0,
    messageWrapperMaxHeight: null, // 消息列表容器最大高度
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    let self = this
    // 寻找聊天室贴图
    let charroomImageIndex = null
    let chatroomList = app.globalData.chatroomList
    chatroomList.map((item, index) => {
      if(item.roomid == options.roomid) {
        charroomImageIndex = index
        return
      }
    })
    // 设置顶部标题
    wx.setNavigationBarTitle({
      title: options.name,
    })
    // 获取聊天室服务端地址
    wx.request({
      url: app.globalData.pageConfig.requestChatroomServerAddress,
      data: {
        roomid: options.roomid
      },
      header: {
        appkey: app.globalData.pageConfig.appkey
      },
      method: 'POST',
      success: (res) => {
        let addr = [...res.data.msg.addr]
        app.globalData.chatroomServer = addr
        // 获取指定聊天室实例
        let chatroomInstance = Chatroom.getInstance({
          appKey: app.globalData.pageConfig.appkey,
          account: app.globalData.account,
          token: app.globalData.password,
          reconnectionAttempts: 10,
          chatroomId: options.roomid,
          chatroomAddresses: addr,
          onconnect: self.onChatroomConnect,
          onerror: self.onChatroomError,
          onwillreconnect: self.onChatroomWillReconnect,
          ondisconnect: self.onChatroomDisconnect,
          onmsgs: self.onChatroomMsgs
        });
        // 暂存聊天室实例
        app.globalData.chatroomInstance = chatroomInstance
      }
    })
    
    this.setData({
      animation: wx.createAnimation({
        duration: 1000,
        timingFunction: 'ease',
      }),
      messageWrapperMaxHeight: wx.getSystemInfoSync().windowHeight - 40 - 54,
      // messageWrapperMaxHeight: wx.getSystemInfoSync().windowHeight - 275 - 40,
      defaultAvatar: app.globalData.pageConfig.defaultAvatar,
      iconBase64Map: iconBase64Map,
      roomInfo: Object.assign({}, app.globalData.chatroomList[charroomImageIndex], {
        roomImage: app.globalData.pageConfig.chatroomImageBaseUrl + 'image' + charroomImageIndex + '.png',
        onlineusercount: +app.globalData.chatroomList[charroomImageIndex].onlineusercount+1, // 自己进去了
      })
    })
  },
  /**
   * 页面卸载清除聊天室实例
   */
  onUnload() {
    if (app.globalData.chatroomInstance) {
      app.globalData.chatroomInstance.destroy({
        done: () => {
          app.globalData.chatroomInstance = null
          app.globalData.inChatroom = false
          console.log('退出聊天室')
        }
      })
    } else {
      app.globalData.chatroomInstance = null
      app.globalData.inChatroom = false
    }
  },
  pageTimer: null,
  getChatroomMembers() {
    let self = this
    // 拉取成员信息
    app.globalData.chatroomInstance.getChatroomMembers({
      guest: false,
      done: (error, obj) => {
        if (error) {
          console.log(error)
          return
        }
        self.mergeOnlineMember(obj.members)
      }
    })
    app.globalData.chatroomInstance.getChatroomMembers({
      guest: true,
      done: (error, obj) => {
        if (error) {
          console.log(error)
          return
        }
        self.mergeOnlineMember(obj.members)
      }
    })
  },
  /**
   * 连接上服务器
   */
  onChatroomConnect(chatroomInfo) {
    // console.log('onChatroomConnect', chatroomInfo)
    this.getChatroomMembers()
  },
  /**
   * 收到消息
   * [{attach: {from,fromNick,gaged,tempMuteDuration,tempMuted,to:[],toNick:[],type},chatroomId,flow,from,custom,content,fromClientType,fromCustom,resend,idClient,status,text,time,type}]
   */
  onChatroomMsgs(msgs) {
    console.log('onChatroomMsgs', msgs)
    let self = this
    msgs.map(msg => {
      switch (msg.type) {
        case 'notification': {
          self.addNotificationToRender(msg)
          break
        }
        case 'text': {
          self.addTextToRender(msg)
          break
        }
        case 'image': {
          self.addImageToRender(msg)
          break
        }
        case 'custom': {
          self.addCustomMsgToRender(msg)
          break
        }
        case 'robot': {

        }
        default: {
          self.addOtherMsgToRender(msg)
          break
        }
      }
    })
    // 滚动到底部
    self.scrollToBottom()
  },
  /**
   * 发生错误
   */
  onChatroomError(error, obj) {
    console.log('onerror', error, obj);
    this.toastAndBack()
  },
  /**
   * 即将重连
   */
  onChatroomWillReconnect(obj) {
    // app.globalData.reconnectionAttempts++
    // if (app.globalData.reconnectionAttempts == 10) {
    //   app.globalData.reconnectionAttempts = 0
    //   this.toastAndBack()
    // }
    console.log(`onwillreconnect-${app.globalData.reconnectionAttempts}`, obj);
  },
  /**
   * 已经断开连接
   */
  onChatroomDisconnect(error) {
    console.log('ondisconnect', error);
    // this.toastAndBack()
  },
  toastAndBack() {
    clearTimeout(this.pageTimer)
    this.pageTimer = setTimeout(() => {
      wx.showToast({
        title: '连接已断开,即将返回',
        duration: 2000,
        success: function () {
          wx.redirectTo({
            url: '/pages/home/home',
          })
        }
      })
    }, 200)
  },
  /**
   * 添加文本(包含emoji)消息到渲染队列中
   */
  addTextToRender(msg) {
    // 刷新界面
    let displayTimeHeader = formatTime(msg.time)
    this.setData({
      messageArr: [...this.data.messageArr, {
        account: msg.from,
        nick: msg.fromNick,
        text: msg.text,
        type: msg.type,
        time: msg.time,
        displayTimeHeader,
        nodes: generateRichTextNode(msg.text)
      }]
    })
  },
  /**
   * 添加图片消息到渲染队列中
   */
  addImageToRender(msg) {
    // 添加到渲染队列
    let displayTimeHeader = formatTime(msg.time)
    this.setData({
      inputValue: '',
      messageArr: [...this.data.messageArr, {
        account: msg.from,
        nick: msg.fromNick,
        text: msg.text,
        file: msg.file, // image消息才有此字段
        type: msg.type, // "image"
        time: msg.time,
        displayTimeHeader,
        nodes: generateImageNode(msg.file)
      }]
    })
  },
  /**
   * 添加通知消息到渲染队列中
   */
  addNotificationToRender(msg) {
    // 添加到渲染队列
    let displayTimeHeader = formatTime(msg.time)
    this.setData({
      messageArr: [...this.data.messageArr, {
        account: msg.from,
        nick: msg.attach.fromNick,
        text: msg.text,
        type: msg.attach.type, // "memberEnter"、"memberExit"
        time: msg.time,
        displayTimeHeader,
        nodes: []
      }]
    })
    // 新增或删除在线成员
    let onlineMember = []
    if (msg.attach.type == 'memberEnter') {
      onlineMember = [...this.data.onlineMember]
      onlineMember.push({
        account: msg.from, 
        avatar: '', 
        nick: msg.attach.fromNick, 
        type: 'guest'
      })
    } else if (msg.attach.type == 'memberExit') {
      this.data.onlineMember.map(member => {
        if(msg.from != member.account) {
          onlineMember.push(member)
        }
      })
    }
    this.setData({
      onlineMember
    })
  },
  /**
   * 添加自定义消息到渲染队列中
   */
  addCustomMsgToRender(msg) {
    // 添加到渲染队列
    let displayTimeHeader = formatTime(msg.time)
    let customContent = JSON.parse(msg['content'])
    let renderType = 'custom'
    if (customContent.type == 1) {
      renderType = '猜拳'
    }
    this.setData({
      messageArr: [...this.data.messageArr, {
        account: msg.from,
        nick: msg.fromNick,
        text: msg.text,
        content: msg.content, // 自定义消息才有此字段
        type: renderType, // "custom"、猜拳
        time: msg.time,
        displayTimeHeader,
        nodes: generateImageNode(generateFingerGuessImageFile(customContent.data.value))
      }]
    })
  },
  /**
   * 添加其他类型消息到渲染队列
   */
  addOtherMsgToRender(msg) {
    // 添加到渲染队列
    let displayTimeHeader = formatTime(msg.time)
    this.setData({
      inputValue: '',
      messageArr: [...this.data.messageArr, {
        account: msg.from,
        nick: msg.fromNick || '',
        text: msg.text,
        type: msg.type, 
        time: msg.time,
        displayTimeHeader,
        nodes: [{
          type: 'text',
          text: `暂不支持该类型消息,请到手机或电脑客户端查看！`
        }]
      }]
    })
  },
  refreshRoomInfo(roomInfo) {
    this.setData({
      roomInfo: Object.assign({}, this.data.roomInfo, {
        onlineusercount: roomInfo.onlineMemberNum
      })
    })
  },
  /**
   * nav点击
   */
  switchNav(e) {
    let self = this
    if (this.data.currentTab == e.currentTarget.dataset.current) {
      return
    } else {
      this.setData({
        currentTab: e.currentTarget.dataset.current
      })
      if (e.currentTarget.dataset.current == 2) {
        // 清除上次数据
        self.setData({
          accountMap: {},
          onlineMember: []
        })
        // 刷新在线成员
        this.getChatroomMembers()
      } else if (e.currentTarget.dataset.current == 1) {
        // 刷新在线人数
        app.globalData.chatroomInstance.getChatroom({
          done: function(err, obj) {
            if(err) {
              console.log(err)
              return
            }
            self.refreshRoomInfo(obj.chatroom)
          }
        });
      }
    }
  },
  /**
   * 转化消息类型
   */
  converMemberType(memberType) {
    switch(memberType) {
      case 'owner': 
        return '房主'
      case 'manager':
        return '管理员'
      case 'restricted':
        return '受限制, 被拉黑或者禁言'
      case 'common': 
        return '普通成员'
      case 'guest':
        return '游客'
    }
  },
  /**
   * 合并在线在线用户信息
   */
  mergeOnlineMember(memberArr) {
    let result = [...this.data.onlineMember]
    let accountMap = Object.assign({}, this.data.accountMap) // 目的是去重
    memberArr.map(member => {
      // 在线成员
      if (member.online == true && !accountMap[member.account]) {
        accountMap[member.account] = member.account
        result.push(Object.assign({}, member, {
          avatar: member.avatar,
          type: this.converMemberType(member.type)
        }))
      }
      // 主播
      if (member.type == 'owner') {
        this.setData({
          ownerInfo: Object.assign({}, member)
        })
      }
    })
    
    this.setData({
      accountMap,
      onlineMember: result
    })
  },
  /**
   * 阻止事件冒泡空函数
   */
  stopEventPropagation() {
  },
  /**
   * 滚动页面到底部
   */
  scrollToBottom() {
    let self = this
    wx.createSelectorQuery().select('#recordWrapper').boundingClientRect(function (rect) {
      if (rect.bottom > self.data.messageWrapperMaxHeight) {
        self.setData({
          scrollTop: 999999
        })
      }
    }).exec()
  },
  /**
   * 输入事件
   */
  inputChange(e) {
    this.setData({
      inputValue: e.detail.value
    })
  },
  /**
   * 获取焦点
   */
  inputFocus(e) {
    this.setData({
      emojiFlag: false,
      focusFlag: true
    })
  },
  /**
   * 失去焦点
   */
  inputBlur() {
    this.setData({
      focusFlag: false
    })
  },
  /**
   * 切换出emoji键盘
   */
  toggleEmoji() {
    this.setData({
      emojiFlag: !this.data.emojiFlag,
      moreFlag: false
    })
  },
  /**
   * 切出更多
   */
  toggleMore() {
    this.setData({
      moreFlag: !this.data.moreFlag,
      emojiFlag: false,
      focusFlag: false
    })
  },
  /**
   * emoji组件回调
   */
  emojiCLick(e) {
    let val = e.detail
    // 单击删除按钮，，删除emoji
    if (val == '[删除]') {
      let lastIndex = this.data.inputValue.lastIndexOf('[')
      if (lastIndex != -1) {
        this.setData({
          inputValue: this.data.inputValue.slice(0, lastIndex)
        })
      }
      return
    }
    if (val[0] == '[') { // emoji
      this.setData({
        inputValue: this.data.inputValue + val
      })
    }
  },
  /**
   * emoji点击发送
   */
  emojiSend(e) {
    let val = this.data.inputValue
    this.sendRequest(val)
    this.setData({
      emojiFlag: false
    })
  },
  /**
   * 发送文本
   */
  inputSend(e) {
    let text = e.detail.value
    this.sendRequest(text)
  },
  /**
   * 选择相册图片
   */
  chooseImageToSend(e) {
    let type = e.currentTarget.dataset.type
    let self = this
    self.setData({
      moreFlag: false
    })
    wx.chooseImage({
      sourceType: ['album'],
      success: function (res) {
        self.sendImageToNOS(res)
      },
    })
  },
  /**
   * 发送网络请求：发送文字
   */
  sendRequest(text) {
    let self = this
    this.setData({
      inputValue: ''
    })
    app.globalData.chatroomInstance.sendText({
      text,
      done: (err, msg) => {
        if (err) {
          console.log(err)
          return
        }
        // 刷新界面
        self.addTextToRender(msg)
        // 滚动到底部
        self.scrollToBottom()
      }
    })
  },
  /**
   * 发送自定义消息-猜拳
   */
  sendFingerGuess() {
    let self = this
    self.setData({
      moreFlag: false
    })
    let content = {
      type: 1,
      data: {
        value: Math.ceil(Math.random() * 3)
      }
    }
    app.globalData.chatroomInstance.sendCustomMsg({
      content: JSON.stringify(content),
      done: function (err, msg) {
        if (err) {
          console.log(err)
          return
        }
        // 刷新界面
        self.addCustomMsgToRender(msg)
        // 滚动到底部
        self.scrollToBottom()
      }
    })
  },
  /**
   * 发送图片到nos
   */
  sendImageToNOS(res) {
    wx.showLoading({
      title: '发送中...',
    })
    let self = this
    let tempFilePaths = res.tempFilePaths
    for (let i = 0; i < tempFilePaths.length; i++) {
      // 上传文件到nos
      app.globalData.chatroomInstance.sendFile({
        type: 'image',
        wxFilePath: tempFilePaths[i],
        done: function (err, msg) {
          wx.hideLoading()
          if (err) {
            console.log(err)
            return
          }
          // 刷新界面
          self.addImageToRender(msg)
          // 滚动到底部
          self.scrollToBottom()
        }
      })
    }
  }
})