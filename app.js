// app.js
// 职责：全局状态管理；云开发初始化；用户登录态检查与 openid 获取；全局数据供各页面读取

App({
  globalData: {
    userInfo: null,   // { openid, nickName, avatarUrl }
    isLoggedIn: false,
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // TODO: 替换为微信云开发控制台中的真实环境 ID
        // 在微信开发者工具 → 云开发 → 环境 中查看
        env: 'YOUR_CLOUD_ENV_ID',
        traceUser: true,
      });
    }

    // 检查本地缓存中的登录态
    this._restoreLoginState();
  },

  /**
   * 从本地缓存恢复登录状态（避免每次冷启动都重新走登录流程）
   */
  _restoreLoginState() {
    try {
      const cached = wx.getStorageSync('__userInfo__');
      if (cached && cached.openid) {
        this.globalData.userInfo = cached;
        this.globalData.isLoggedIn = true;
      }
    } catch (e) {
      console.warn('恢复登录状态失败', e);
    }
  },

  /**
   * 写入全局登录信息，同时持久化到 Storage
   * @param {Object} userInfo - { openid, nickName, avatarUrl }
   */
  setLoginInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    this.globalData.isLoggedIn = true;
    try {
      wx.setStorageSync('__userInfo__', userInfo);
    } catch (e) {
      console.warn('持久化 userInfo 失败', e);
    }
  },

  /**
   * 清除登录信息（退出登录）
   */
  clearLoginInfo() {
    this.globalData.userInfo = null;
    this.globalData.isLoggedIn = false;
    try {
      wx.removeStorageSync('__userInfo__');
    } catch (e) {
      console.warn('清除 userInfo 失败', e);
    }
  },
});
