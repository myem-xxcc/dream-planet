App({
  onLaunch() {
    // 初始化本地存储
    const dreams = wx.getStorageSync('dreams');
    if (!dreams) {
      wx.setStorageSync('dreams', []);
    }
  },

  // 全局获取梦境列表
  getDreams() {
    return wx.getStorageSync('dreams') || [];
  },

  // 保存梦境
  saveDream(dream) {
    const dreams = this.getDreams();
    dream.id = Date.now().toString();
    dream.createdAt = new Date().toLocaleDateString('zh-CN');
    // 随机分配球面位置（球坐标：theta 纬度 [-60,60], phi 经度 [0,360]）
    dream.theta = (Math.random() * 120 - 60) * Math.PI / 180;
    dream.phi = Math.random() * 2 * Math.PI;
    dreams.unshift(dream);
    wx.setStorageSync('dreams', dreams);
    return dream;
  },

  deleteDream(id) {
    const dreams = this.getDreams().filter(d => d.id !== id);
    wx.setStorageSync('dreams', dreams);
  }
});
