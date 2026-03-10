// pages/dream-publish/dream-publish.js
// 职责：梦境发布/编辑页 —— 文字输入、语音录入、情绪标签、日期选择、云端提交

const app = getApp();

const MOOD_OPTIONS = [
  { value: 'weird',  label: '奇异' },
  { value: 'gentle', label: '温柔' },
  { value: 'horror', label: '惊悚' },
  { value: 'psyche', label: '迷幻' },
  { value: 'lucid',  label: '清醒' },
];

Page({
  data: {
    mode: 'create',           // 'create' | 'edit'
    _editId: '',

    // 表单字段
    title: '',
    content: '',
    mood: 'weird',
    date: '',

    // 输入模式
    inputMode: 'text',        // 'text' | 'voice'

    // 录音状态
    isRecording: false,
    recordDuration: 0,        // 已录制秒数
    audioTempPath: '',        // 录音临时文件路径
    _recordStartTime: 0,

    // 提交
    isSubmitting: false,

    moodOptions: MOOD_OPTIONS,
  },

  _recorderManager: null,
  _recordTimer: null,

  onLoad(options) {
    // 初始化日期为今天
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.setData({ date: dateStr });

    if (options.mode === 'edit' && options.id) {
      this.setData({ mode: 'edit', _editId: options.id });
      this._loadEditData(options.id);
    }

    this._initRecorder();
  },

  onUnload() {
    this._stopRecordTimer();
    if (this._recorderManager) {
      try { this._recorderManager.stop(); } catch (_) {}
    }
  },

  /** 编辑模式：预填已有数据 */
  async _loadEditData(id) {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('dreams').doc(id).get();
      const d = res.data;
      this.setData({
        title:    d.title   || '',
        content:  d.content || '',
        mood:     d.mood    || 'weird',
        date:     d.date    || this.data.date,
        audioTempPath: '',   // 编辑时不预填音频，重录则替换
        recordDuration: d.audioDuration || 0,
      });
    } catch (e) {
      console.error('预填数据失败', e);
    }
  },

  /** 初始化录音管理器 */
  _initRecorder() {
    this._recorderManager = wx.getRecorderManager();

    this._recorderManager.onStart(() => {
      this.setData({ isRecording: true, _recordStartTime: Date.now() });
      this._startRecordTimer();
    });

    this._recorderManager.onStop((res) => {
      this._stopRecordTimer();
      const duration = Math.round((Date.now() - this.data._recordStartTime) / 1000);
      this.setData({
        isRecording: false,
        audioTempPath: res.tempFilePath,
        recordDuration: duration,
      });
    });

    this._recorderManager.onError((e) => {
      console.error('录音错误', e);
      this._stopRecordTimer();
      this.setData({ isRecording: false });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  _startRecordTimer() {
    this._recordTimer = setInterval(() => {
      this.setData({ recordDuration: this.data.recordDuration + 1 });
      if (this.data.recordDuration >= 300) {
        // 最长 5 分钟自动停止
        this._stopRecording();
      }
    }, 1000);
  },

  _stopRecordTimer() {
    clearInterval(this._recordTimer);
    this._recordTimer = null;
  },

  /** 切换输入模式 */
  onSwitchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ inputMode: mode });
  },

  /** 表单输入绑定 */
  onTitleInput(e)   { this.setData({ title: e.detail.value }); },
  onContentInput(e) { this.setData({ content: e.detail.value }); },
  onDateChange(e)   { this.setData({ date: e.detail.value }); },

  /** 情绪标签选择 */
  onMoodSelect(e) {
    this.setData({ mood: e.currentTarget.dataset.value });
  },

  /** 长按录音开始 */
  onRecordStart() {
    if (this.data.isRecording) return;
    this.setData({ recordDuration: 0, audioTempPath: '' });
    this._recorderManager.start({
      duration: 300000,         // 最长 5 分钟
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 96000,
      format: 'aac',
    });
  },

  /** 松开结束录音 */
  onRecordStop() {
    if (!this.data.isRecording) return;
    this._recorderManager.stop();
  },

  /** 重新录制 */
  onReRecord() {
    this.setData({ audioTempPath: '', recordDuration: 0 });
  },

  onTapBack() {
    wx.navigateBack();
  },

  /** 提交（新建 or 编辑） */
  async onSubmit() {
    const { title, content, mood, date, audioTempPath, recordDuration, mode, _editId, isSubmitting } = this.data;
    if (isSubmitting) return;

    if (!title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: mode === 'edit' ? '保存中...' : '发布中...' });

    try {
      let audioFileID = '';

      // 上传音频到云存储
      if (audioTempPath) {
        const ext = audioTempPath.split('.').pop() || 'aac';
        const cloudPath = `audio/${app.globalData.userInfo.openid}/${Date.now()}.${ext}`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: audioTempPath,
        });
        audioFileID = uploadRes.fileID;
      }

      const db = wx.cloud.database();
      const now = new Date().toISOString();

      if (mode === 'edit') {
        const updateData = {
          title: title.trim(),
          content: content.trim(),
          mood,
          date,
          updatedAt: now,
        };
        if (audioFileID) {
          updateData.hasAudio = true;
          updateData.audioFileID = audioFileID;
          updateData.audioDuration = recordDuration;
        }
        await db.collection('dreams').doc(_editId).update({ data: updateData });
      } else {
        // 为新梦境分配球面位置
        const theta = (Math.random() * 120 - 60) * (Math.PI / 180);
        const phi   = Math.random() * Math.PI * 2;

        await db.collection('dreams').add({
          data: {
            openid:       app.globalData.userInfo.openid,
            title:        title.trim(),
            content:      content.trim(),
            mood,
            date,
            hasAudio:     !!audioFileID,
            audioFileID:  audioFileID || '',
            audioDuration: audioFileID ? recordDuration : 0,
            theta,
            phi,
            createdAt:    now,
            updatedAt:    now,
          },
        });
      }

      wx.hideLoading();
      wx.showToast({ title: mode === 'edit' ? '已保存' : '发布成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (e) {
      wx.hideLoading();
      console.error('提交失败', e);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },
});
