// pages/profile/profile.js
// 职责：个人中心页 —— 用户信息展示、梦境统计、昵称编辑、退出登录、梦境简要列表

const app = getApp();

const MOOD_MAP = {
  weird:  '奇异',
  gentle: '温柔',
  horror: '惊悚',
  psyche: '迷幻',
  lucid:  '清醒',
};

Page({
  data: {
    userInfo: null,
    stats: {
      totalCount:  0,
      monthCount:  0,
      topMood:     '--',
    },
    dreamList: [],
    isEditingNick: false,
    nickNameInput: '',
    isLoading: true,
  },

  onLoad() {
    if (!app.globalData.isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ userInfo: app.globalData.userInfo });
    this._loadData();
  },

  onShow() {
    // Tab 切换回来时刷新数据
    if (app.globalData.isLoggedIn) {
      this._loadData();
    }
  },

  /** 加载统计数据和梦境列表 */
  async _loadData() {
    this.setData({ isLoading: true });
    try {
      const db = wx.cloud.database();
      const openid = app.globalData.userInfo.openid;

      // 拉取全部梦境（仅需要 mood、date、title 字段）
      const { data } = await db.collection('dreams')
        .where({ openid })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      // 统计
      const totalCount = data.length;
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthCount = data.filter(d => (d.date || '').startsWith(monthStr)).length;

      // 最常见情绪
      const moodCounts = {};
      data.forEach(d => {
        if (d.mood) moodCounts[d.mood] = (moodCounts[d.mood] || 0) + 1;
      });
      let topMood = '--';
      if (Object.keys(moodCounts).length > 0) {
        const topKey = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0][0];
        topMood = MOOD_MAP[topKey] || topKey;
      }

      // 简要列表（最多 30 条）
      const dreamList = data.slice(0, 30).map(d => ({
        ...d,
        moodLabel: MOOD_MAP[d.mood] || d.mood,
      }));

      this.setData({
        stats: { totalCount, monthCount, topMood },
        dreamList,
        isLoading: false,
        userInfo: app.globalData.userInfo,
      });
    } catch (e) {
      console.error('加载个人数据失败', e);
      this.setData({ isLoading: false });
    }
  },

  /** 开启昵称内联编辑 */
  onEditNick() {
    this.setData({
      isEditingNick: true,
      nickNameInput: this.data.userInfo.nickName || '',
    });
  },

  onNickInput(e) {
    this.setData({ nickNameInput: e.detail.value });
  },

  /** 保存昵称 */
  async onSaveNick() {
    const nickName = this.data.nickNameInput.trim();
    if (!nickName) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    try {
      const db = wx.cloud.database();
      await db.collection('users')
        .where({ openid: app.globalData.userInfo.openid })
        .update({ data: { nickName } });

      const newUserInfo = { ...app.globalData.userInfo, nickName };
      app.setLoginInfo(newUserInfo);
      this.setData({
        userInfo: newUserInfo,
        isEditingNick: false,
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (e) {
      console.error('保存昵称失败', e);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onCancelNick() {
    this.setData({ isEditingNick: false });
  },

  /** 退出登录 */
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#ef4444',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          app.clearLoginInfo();
          wx.reLaunch({ url: '/pages/planet/planet' });
        }
      },
    });
  },

  /** 点击梦境列表项跳详情 */
  onDreamTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/dream-detail/dream-detail?id=${id}` });
  },
});
