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
   * 登录按钮点击 —— 直接调用云函数获取 openid
   * wx.getUserProfile 在基础库 2.27.1+ 已废弃，新版微信不再支持
   * 改为直接用 openid 作为用户唯一标识，昵称/头像引导用户在 profile 页设置
   */
  onLoginTap() {
    if (this.data.isLoggingIn) return;
    this._doLogin({ nickName: '梦境旅人', avatarUrl: '' });
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
      const msg = e.message || JSON.stringify(e);
      wx.showToast({ title: msg.includes('env') ? '云环境未配置' : '登录失败，请重试', icon: 'none', duration: 3000 });
    } finally {
      this.setData({ isLoggingIn: false });
    }
  },
});
