// pages/dream-detail/dream-detail.js
// 职责：梦境详情页 —— 展示完整内容、音频播放控件、编辑/删除操作

const app = getApp();

Page({
  data: {
    dream: null,          // { _id, title, content, mood, audioFileID, audioDuration, createdAt, date }
    isPlaying: false,
    playProgress: 0,      // 0~1
    currentTime: '00:00', // 当前播放时间 mm:ss
    isLoading: true,
    _dreamId: '',
  },

  _audioCtx: null,
  _progressTimer: null,

  // 情绪标签中文映射
  _moodMap: {
    weird:   '奇异',
    gentle:  '温柔',
    horror:  '惊悚',
    psyche:  '迷幻',
    lucid:   '清醒',
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.setData({ _dreamId: id });
    this._fetchDream(id);
  },

  onUnload() {
    this._stopAudio();
  },

  /** 从云数据库加载单条梦境 */
  async _fetchDream(id) {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('dreams').doc(id).get();
      const dream = res.data;
      // 追加情绪中文
      dream.moodLabel = this._moodMap[dream.mood] || dream.mood;
      // 格式化时长 mm:ss
      dream.audioDurationLabel = this._formatTime(dream.audioDuration || 0);
      // 格式化创建时间
      if (dream.createdAt) {
        const d = new Date(dream.createdAt);
        dream.createdAtLabel = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      } else {
        dream.createdAtLabel = dream.date || '';
      }
      this.setData({ dream, isLoading: false });
    } catch (e) {
      console.error('加载梦境失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ isLoading: false });
    }
  },

  /** 音频播放 / 暂停切换 */
  onAudioToggle() {
    if (this.data.isPlaying) {
      this._pauseAudio();
    } else {
      this._playAudio();
    }
  },

  async _playAudio() {
    const { dream } = this.data;
    if (!dream || !dream.audioFileID) return;

    // 首次播放时初始化 InnerAudioContext
    if (!this._audioCtx) {
      this._audioCtx = wx.createInnerAudioContext();
      // 获取临时 URL（云存储 fileID → 临时链接）
      try {
        const { fileList } = await wx.cloud.getTempFileURL({
          fileList: [dream.audioFileID],
        });
        this._audioCtx.src = fileList[0].tempFileURL;
      } catch (e) {
        wx.showToast({ title: '音频加载失败', icon: 'none' });
        return;
      }

      this._audioCtx.onEnded(() => {
        this._stopAudio();
      });
      this._audioCtx.onError((err) => {
        console.error('音频播放错误', err);
        this._stopAudio();
      });
    }

    this._audioCtx.play();
    this.setData({ isPlaying: true });

    // 进度轮询
    this._progressTimer = setInterval(() => {
      if (!this._audioCtx) return;
      const total = dream.audioDuration || 1;
      const cur = this._audioCtx.currentTime || 0;
      this.setData({
        currentTime: this._formatTime(cur),
        playProgress: Math.min(cur / total, 1),
      });
    }, 500);
  },

  _pauseAudio() {
    if (this._audioCtx) this._audioCtx.pause();
    clearInterval(this._progressTimer);
    this.setData({ isPlaying: false });
  },

  _stopAudio() {
    if (this._audioCtx) {
      this._audioCtx.stop();
      this._audioCtx.destroy();
      this._audioCtx = null;
    }
    clearInterval(this._progressTimer);
    this.setData({ isPlaying: false, playProgress: 0, currentTime: '00:00' });
  },

  /** 右上角菜单 —— 编辑 */
  onEdit() {
    const { _dreamId } = this.data;
    wx.navigateTo({
      url: `/pages/dream-publish/dream-publish?id=${_dreamId}&mode=edit`,
    });
  },

  /** 右上角菜单 —— 删除 */
  onDelete() {
    wx.showModal({
      title: '删除梦境',
      content: '确定要删除这条梦境记录吗？此操作不可撤销。',
      confirmText: '删除',
      confirmColor: '#ef4444',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this._deleteDream();
        }
      },
    });
  },

  async _deleteDream() {
    wx.showLoading({ title: '删除中...' });
    try {
      const db = wx.cloud.database();
      await db.collection('dreams').doc(this.data._dreamId).remove();
      wx.hideLoading();
      wx.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/planet/planet' });
      }, 1000);
    } catch (e) {
      wx.hideLoading();
      console.error('删除失败', e);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  /** 格式化秒数 mm:ss */
  _formatTime(sec) {
    const m = Math.floor((sec || 0) / 60);
    const s = Math.floor((sec || 0) % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  /** 供 WXML 使用的格式化 computed（通过辅助方法暴露） */
  onTapBack() {
    wx.navigateBack();
  },
});
