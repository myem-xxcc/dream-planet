// pages/planet/planet.js
// 职责：星球首页逻辑 —— canvas 2D 绘制交互星球、从云数据库拉取梦境、
//       在星球表面渲染悬浮气泡、手势拖拽旋转与双指缩放

const app = getApp();

// 球面坐标转屏幕坐标的投影辅助
const DEG2RAD = Math.PI / 180;

Page({
  data: {
    dreams: [],
    bubbles: [],          // [{ x, y, title, id, visible }]
    rotateX: 0,           // 当前旋转角 X 轴（弧度）
    rotateY: 0,           // 当前旋转角 Y 轴（弧度）
    scaleRatio: 1.0,      // 缩放比例 0.6~2.0
    isLoading: true,
    canvasWidth: 0,
    canvasHeight: 0,
    _centerX: 0,
    _centerY: 0,
    _radius: 0,
  },

  // canvas 2D 上下文
  _ctx: null,
  _animFrameId: null,

  // 手势跟踪
  _lastTouchX: 0,
  _lastTouchY: 0,
  _lastPinchDist: 0,
  _isDragging: false,

  // 星点数据（静态，只生成一次）
  _stars: [],

  onLoad() {
    this._initCanvas();
  },

  onShow() {
    // 每次显示时重新拉取数据（支持发布后返回刷新）
    if (app.globalData.isLoggedIn) {
      this._fetchDreams();
    } else {
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  onUnload() {
    if (this._canvas && this._animFrameId) {
      this._canvas.cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
  },

  /** 初始化 canvas，获取尺寸，生成星点 */
  _initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#planet-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio;
        const w = res[0].width;
        const h = res[0].height;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        this._canvas = canvas;
        this._ctx = ctx;
        this._dpr = dpr;

        const radius = Math.min(w, h) * 0.38;
        this.setData({
          canvasWidth: w,
          canvasHeight: h,
          _centerX: w / 2,
          _centerY: h / 2,
          _radius: radius,
        });

        this._generateStars(w, h);
        this._startRenderLoop();
      });
  },

  /** 生成随机星点 */
  _generateStars(w, h) {
    const stars = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
    this._stars = stars;
    this._twinkleT = 0;
  },

  /** 渲染循环 */
  _startRenderLoop() {
    const loop = () => {
      this._drawFrame();
      this._animFrameId = this._canvas.requestAnimationFrame(loop);
    };
    loop();
  },

  /** 单帧绘制 */
  _drawFrame() {
    const ctx = this._ctx;
    if (!ctx) return;
    const { canvasWidth: w, canvasHeight: h, _centerX: cx, _centerY: cy, _radius: r, scaleRatio } = this.data;

    ctx.clearRect(0, 0, w, h);

    // 绘制背景渐变
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a0533');
    bg.addColorStop(0.5, '#0d0120');
    bg.addColorStop(1, '#06010f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 绘制星点
    this._twinkleT += 1;
    this._stars.forEach(s => {
      const alpha = s.alpha * (0.6 + 0.4 * Math.sin(this._twinkleT * s.twinkleSpeed + s.twinklePhase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(226, 217, 243, ${alpha})`;
      ctx.fill();
    });

    // 绘制星球
    const scaledR = r * scaleRatio;
    this._drawPlanet(ctx, cx, cy, scaledR);

    // 更新气泡位置
    this._updateBubbles(cx, cy, scaledR);
  },

  /** 绘制星球球体 */
  _drawPlanet(ctx, cx, cy, r) {
    // 外发光
    const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.3);
    glowGrad.addColorStop(0, 'rgba(124, 92, 204, 0.3)');
    glowGrad.addColorStop(1, 'rgba(124, 92, 204, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // 球体主体渐变
    const bodyGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    bodyGrad.addColorStop(0, '#3a1a6e');
    bodyGrad.addColorStop(0.5, '#1e0a4a');
    bodyGrad.addColorStop(1, '#0d0120');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 球体高光
    const hlGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx - r * 0.2, cy - r * 0.2, r * 0.55);
    hlGrad.addColorStop(0, 'rgba(226, 217, 243, 0.18)');
    hlGrad.addColorStop(1, 'rgba(226, 217, 243, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = hlGrad;
    ctx.fill();

    // 纹理圆环
    const { rotateX, rotateY } = this.data;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    for (let i = 0; i < 4; i++) {
      const phaseOffset = i * (Math.PI / 2);
      const bandY = cy + r * 0.6 * Math.sin(rotateX + phaseOffset);
      const bandAlpha = 0.06 + 0.04 * Math.sin(rotateY + i);
      ctx.beginPath();
      ctx.ellipse(cx, bandY, r * 0.95, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167, 139, 250, ${bandAlpha})`;
      ctx.fill();
    }
    ctx.restore();

    // 边缘阴影（增加立体感）
    const edgeGrad = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
    edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = edgeGrad;
    ctx.fill();

    // 轮廓描边
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },

  /**
   * 将梦境球面坐标投影为屏幕坐标，并更新 bubbles 数组
   * 每条梦境有固定的 theta/phi（球坐标），根据当前旋转和缩放计算屏幕位置
   */
  _updateBubbles(cx, cy, scaledR) {
    const { dreams, rotateX, rotateY, scaleRatio } = this.data;
    if (!dreams.length) return;

    const bubbles = dreams.map(dream => {
      const theta = dream.theta || 0;  // 纬度（-π/3 ~ π/3）
      const phi = dream.phi || 0;      // 经度（0 ~ 2π）

      // 旋转后坐标
      const phiR = phi + rotateY;
      const thetaR = theta + rotateX * 0.3;

      const x3 = Math.cos(thetaR) * Math.cos(phiR);
      const y3 = Math.sin(thetaR);
      const z3 = Math.cos(thetaR) * Math.sin(phiR);

      // z3 > 0 表示在星球正面可见
      const visible = z3 > -0.15 && scaleRatio > 0.7;
      const depth = (z3 + 1) / 2;   // 0~1，用于透明度

      return {
        id: dream._id,
        title: dream.title,
        x: cx + x3 * scaledR,
        y: cy - y3 * scaledR * 0.92,
        visible,
        depth,
      };
    });

    this.setData({ bubbles });
  },

  /** 从云数据库拉取当前用户最近 20 条梦境 */
  async _fetchDreams() {
    this.setData({ isLoading: true });
    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('dreams')
        .where({ openid: app.globalData.userInfo.openid })
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      // 如果没有球面坐标则随机分配（兼容旧数据）
      const dreams = data.map(d => ({
        ...d,
        theta: d.theta !== undefined ? d.theta : (Math.random() * 120 - 60) * DEG2RAD,
        phi:   d.phi   !== undefined ? d.phi   : Math.random() * Math.PI * 2,
      }));

      this.setData({ dreams, isLoading: false });
    } catch (e) {
      console.error('拉取梦境失败', e);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      this.setData({ isLoading: false });
    }
  },

  /** 触摸开始 */
  onTouchStart(e) {
    if (e.touches.length === 1) {
      this._isDragging = true;
      this._lastTouchX = e.touches[0].clientX;
      this._lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      this._isDragging = false;
      this._lastPinchDist = this._getPinchDist(e.touches);
    }
  },

  /** 触摸移动 —— 拖拽旋转 / 捏合缩放 */
  onTouchMove(e) {
    if (e.touches.length === 1 && this._isDragging) {
      const dx = e.touches[0].clientX - this._lastTouchX;
      const dy = e.touches[0].clientY - this._lastTouchY;
      this._lastTouchX = e.touches[0].clientX;
      this._lastTouchY = e.touches[0].clientY;

      const sensitivity = 0.006;
      let { rotateX, rotateY } = this.data;
      rotateY += dx * sensitivity;
      rotateX += dy * sensitivity;
      rotateX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotateX));

      this.setData({ rotateX, rotateY });
    } else if (e.touches.length === 2) {
      const dist = this._getPinchDist(e.touches);
      const delta = dist / this._lastPinchDist;
      this._lastPinchDist = dist;

      let scale = this.data.scaleRatio * delta;
      scale = Math.max(0.6, Math.min(2.0, scale));
      this.setData({ scaleRatio: scale });
    }
  },

  onTouchEnd() {
    this._isDragging = false;
  },

  /** 计算双指距离 */
  _getPinchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /** 点击气泡跳转详情 */
  onBubbleTap(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/dream-detail/dream-detail?id=${id}` });
    }
  },
});
