// pages/publish/publish.js
const app = getApp();

Page({
  data: {
    title: '',
    content: '',
    mode: 'text',        // 'text' | 'voice'
    recording: false,
    recorded: false,
    recordDuration: 0,
    recordPath: '',
    titlePlaceholder: '给这个梦境起个名字...',
    contentPlaceholder: '描述你的梦境，越详细越好...',
    tags: ['奇异', '温馨', '恐怖', '浪漫', '神秘', '冒险', '搞笑', '悲伤'],
    selectedTags: [],
    submitting: false,
  },

  _recorder: null,
  _timer: null,

  onLoad() {
    this._recorder = wx.getRecorderManager();
    this._recorder.onStop((res) => {
      this.setData({
        recording: false,
        recorded: true,
        recordPath: res.tempFilePath,
      });
      clearInterval(this._timer);
    });
    this._recorder.onError(() => {
      this.setData({ recording: false });
      clearInterval(this._timer);
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  onInputTitle(e) {
    this.setData({ title: e.detail.value });
  },

  onInputContent(e) {
    this.setData({ content: e.detail.value });
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode });
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag;
    let tags = [...this.data.selectedTags];
    const idx = tags.indexOf(tag);
    if (idx >= 0) {
      tags.splice(idx, 1);
    } else if (tags.length < 4) {
      tags.push(tag);
    }
    this.setData({ selectedTags: tags });
  },

  // 录音
  startRecord() {
    wx.authorize({ scope: 'scope.record' }).then(() => {
      this._recorder.start({ duration: 60000, format: 'mp3' });
      let sec = 0;
      this._timer = setInterval(() => {
        sec++;
        this.setData({ recordDuration: sec });
        if (sec >= 60) this.stopRecord();
      }, 1000);
      this.setData({ recording: true, recorded: false, recordDuration: 0 });
    }).catch(() => {
      wx.showModal({
        title: '需要录音权限',
        content: '请在设置中允许使用麦克风',
        showCancel: false,
      });
    });
  },

  stopRecord() {
    this._recorder.stop();
  },

  deleteRecord() {
    this.setData({ recorded: false, recordPath: '', recordDuration: 0 });
  },

  playRecord() {
    const audio = wx.createInnerAudioContext();
    audio.src = this.data.recordPath;
    audio.play();
  },

  formatDuration(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },

  onSubmit() {
    const { title, content, mode, recordPath, selectedTags, submitting } = this.data;
    if (submitting) return;
    if (!title.trim()) {
      wx.showToast({ title: '请输入梦境标题', icon: 'none' });
      return;
    }
    if (mode === 'text' && !content.trim()) {
      wx.showToast({ title: '请描述你的梦境', icon: 'none' });
      return;
    }
    if (mode === 'voice' && !recordPath) {
      wx.showToast({ title: '请先录制语音', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    const dream = {
      title: title.trim(),
      content: mode === 'text' ? content.trim() : '',
      voicePath: mode === 'voice' ? recordPath : '',
      voiceDuration: mode === 'voice' ? this.data.recordDuration : 0,
      mode,
      tags: selectedTags,
    };

    app.saveDream(dream);

    wx.showToast({ title: '梦境已记录 ✨', icon: 'none', duration: 1500 });
    setTimeout(() => {
      wx.navigateBack();
    }, 1600);
  },

  onUnload() {
    clearInterval(this._timer);
    if (this.data.recording) {
      this._recorder.stop();
    }
  },
});
