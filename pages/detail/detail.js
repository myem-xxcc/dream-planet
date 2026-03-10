// pages/detail/detail.js
const app = getApp();

Page({
  data: {
    dream: null,
    playing: false,
  },

  _audio: null,

  onLoad(options) {
    const { id } = options;
    const dreams = app.getDreams();
    const dream = dreams.find(d => d.id === id);
    if (dream) {
      this.setData({ dream });
      wx.setNavigationBarTitle({ title: dream.title });
    }
  },

  onUnload() {
    if (this._audio) {
      this._audio.stop();
      this._audio.destroy();
    }
  },

  playVoice() {
    const { dream, playing } = this.data;
    if (!dream.voicePath) return;

    if (playing) {
      this._audio && this._audio.pause();
      this.setData({ playing: false });
      return;
    }

    if (!this._audio) {
      this._audio = wx.createInnerAudioContext();
      this._audio.src = dream.voicePath;
      this._audio.onEnded(() => this.setData({ playing: false }));
      this._audio.onError(() => {
        this.setData({ playing: false });
        wx.showToast({ title: '播放失败', icon: 'none' });
      });
    }
    this._audio.play();
    this.setData({ playing: true });
  },

  onDelete() {
    wx.showModal({
      title: '删除梦境',
      content: '确定要删除这个梦境吗？',
      confirmColor: '#f87171',
      success: (res) => {
        if (res.confirm) {
          app.deleteDream(this.data.dream.id);
          wx.showToast({ title: '已删除', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 800);
        }
      }
    });
  },

  formatDate(str) {
    return str || '';
  }
});
