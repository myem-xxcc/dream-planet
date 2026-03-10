// pages/login/login.js
// 职责：登录页逻辑 —— 微信一键登录、调用云函数获取 openid、写入 globalData 和 Storage

const app = getApp();

Page({
  data: {
    isLoggingIn: false,
  },

  onLoad() {
    // 已登录则直接跳星球
    if (app.globalData.isLoggedIn) {
      wx.reLaunch({ url: '/pages/planet/planet' });
    }
  },

  /**
   * 微信登录按钮回调（open-type="getUserInfo" 或 open-type="getPhoneNumber"）
   * 新版 API 使用 wx.getUserProfile 或 button open-type="getUserInfo"
   * 此处采用 button bindgetuserinfo 方式（基础库 2.10.4+ 推荐用 getUserProfile）
   */
  onGetUserInfo(e) {
    if (this.data.isLoggingIn) return;
    if (e.detail.errMsg !== 'getUserInfo:ok') {
      wx.showToast({ title: '授权失败，请重试', icon: 'none' });
      return;
    }
    this._doLogin(e.detail.userInfo);
  },

  /** 备用：直接点击登录按钮（不依赖 getUserInfo）*/
  onLoginTap() {
    if (this.data.isLoggingIn) return;
    // 使用 wx.getUserProfile（基础库 2.10.4+）
    wx.getUserProfile({
      desc: '用于展示您的头像和昵称',
      success: (res) => {
        this._doLogin(res.userInfo);
      },
      fail: () => {
        wx.showToast({ title: '授权失败，请重试', icon: 'none' });
      },
    });
  },

  /** 执行登录流程：调用云函数 login → 存 globalData → 跳星球 */
  async _doLogin(wxUserInfo) {
    this.setData({ isLoggingIn: true });
    wx.showLoading({ title: '登录中...' });

    try {
      // 调用云函数获取 openid 并写/更新用户记录
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {
          nickName:  wxUserInfo.nickName,
          avatarUrl: wxUserInfo.avatarUrl,
        },
      });

      const { openid } = res.result;
      if (!openid) throw new Error('未获取到 openid');

      const userInfo = {
        openid,
        nickName:  wxUserInfo.nickName,
        avatarUrl: wxUserInfo.avatarUrl,
      };

      app.setLoginInfo(userInfo);
      wx.hideLoading();
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/planet/planet' });
      }, 1000);
    } catch (e) {
      wx.hideLoading();
      console.error('登录失败', e);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isLoggingIn: false });
    }
  },
});
