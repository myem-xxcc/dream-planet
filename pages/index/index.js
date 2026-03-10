// pages/index/index.js
const app = getApp();

// 球体半径（canvas 坐标）
const RADIUS = 130;
// 气泡颜色池
const BUBBLE_COLORS = [
  '#c084fc', '#818cf8', '#67e8f9', '#f0abfc',
  '#a78bfa', '#38bdf8', '#e879f9', '#7dd3fc'
];

Page({
  data: {
    canvasWidth: 375,
    canvasHeight: 500,
    dreams: [],
    showEmpty: false,
  },

  // 旋转状态
  _rotX: 0.3,   // 当前 X 轴旋转角（弧度）
  _rotY: 0,     // 当前 Y 轴旋转角
  _lastX: 0,
  _lastY: 0,
  _animRAF: null,
  _autoRotSpeed: 0.003,
  _dragging: false,
  _ctx: null,
  _bubbles: [],  // 气泡缓存
  _canvasCenterX: 0,
  _canvasCenterY: 0,

  onLoad() {
    const info = wx.getSystemInfoSync();
    const w = info.windowWidth;
    const h = Math.min(info.windowHeight * 0.72, 520);
    this.setData({ canvasWidth: w, canvasHeight: h });
    this._canvasCenterX = w / 2;
    this._canvasCenterY = h / 2;
  },

  onShow() {
    this._loadDreams();
  },

  onReady() {
    const query = wx.createSelectorQuery();
    query.select('#planetCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = this.data.canvasWidth * dpr;
        canvas.height = this.data.canvasHeight * dpr;
        ctx.scale(dpr, dpr);
        this._canvas = canvas;
        this._ctx = ctx;
        this._startRender();
      });
  },

  _loadDreams() {
    const dreams = app.getDreams();
    this._bubbles = dreams.map((d, i) => ({
      id: d.id,
      title: d.title,
      phi: d.phi,
      theta: d.theta,
      color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
      radius: 18 + Math.random() * 10,
    }));
    this.setData({ dreams, showEmpty: dreams.length === 0 });
  },

  // ── 渲染循环 ──────────────────────────────
  _startRender() {
    const render = () => {
      this._drawFrame();
      if (!this._dragging) {
        this._rotY += this._autoRotSpeed;
      }
      this._animRAF = this._canvas.requestAnimationFrame(render);
    };
    render();
  },

  _drawFrame() {
    const ctx = this._ctx;
    const cx = this._canvasCenterX;
    const cy = this._canvasCenterY;
    const w = this.data.canvasWidth;
    const h = this.data.canvasHeight;

    // 清空
    ctx.clearRect(0, 0, w, h);

    // 星空背景粒子（固定种子，简单绘制）
    this._drawStars(ctx, w, h);

    // 球体光晕
    const glow = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, RADIUS + 40);
    glow.addColorStop(0, 'rgba(120,80,200,0.18)');
    glow.addColorStop(0.5, 'rgba(60,40,140,0.10)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, RADIUS + 40, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // 球体主体
    const ballGrad = ctx.createRadialGradient(cx - 40, cy - 40, 10, cx, cy, RADIUS);
    ballGrad.addColorStop(0, '#3b2f6e');
    ballGrad.addColorStop(0.5, '#1a1040');
    ballGrad.addColorStop(1, '#0d0820');
    ctx.beginPath();
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // 球体边缘光
    const rimGrad = ctx.createRadialGradient(cx, cy, RADIUS - 6, cx, cy, RADIUS + 2);
    rimGrad.addColorStop(0, 'rgba(140,100,255,0)');
    rimGrad.addColorStop(1, 'rgba(160,120,255,0.45)');
    ctx.beginPath();
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 6;
    ctx.stroke();

    // 高光
    ctx.beginPath();
    ctx.arc(cx - 42, cy - 42, 22, 0, Math.PI * 2);
    const hl = ctx.createRadialGradient(cx - 50, cy - 50, 2, cx - 42, cy - 42, 22);
    hl.addColorStop(0, 'rgba(255,255,255,0.18)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fill();

    // 绘制气泡（根据 z 值排序，近的最后画）
    this._drawBubbles(ctx, cx, cy);
  },

  _stars: null,
  _drawStars(ctx, w, h) {
    if (!this._stars) {
      this._stars = Array.from({ length: 80 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.7 + 0.3,
      }));
    }
    this._stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,190,255,${s.a})`;
      ctx.fill();
    });
  },

  _drawBubbles(ctx, cx, cy) {
    if (!this._bubbles.length) return;

    // 将球坐标投影到屏幕坐标
    const projected = this._bubbles.map(b => {
      // 旋转：先绕 X 轴（_rotX），再绕 Y 轴（_rotY）
      const cosT = Math.cos(b.theta), sinT = Math.sin(b.theta);
      const cosP = Math.cos(b.phi + this._rotY), sinP = Math.sin(b.phi + this._rotY);

      // 球面坐标 → 3D 直角坐标
      let x3 = RADIUS * cosT * sinP;
      let y3 = RADIUS * sinT;
      let z3 = RADIUS * cosT * cosP;

      // 绕 X 轴旋转
      const cosRX = Math.cos(this._rotX), sinRX = Math.sin(this._rotX);
      const y3r = y3 * cosRX - z3 * sinRX;
      const z3r = y3 * sinRX + z3 * cosRX;

      // 透视投影
      const scale = (RADIUS + 180) / (RADIUS + 180 - z3r * 0.5);
      const sx = cx + x3 * scale;
      const sy = cy + y3r * scale;

      return { ...b, sx, sy, z: z3r, scale };
    });

    // 按 z 排序（背面先画）
    projected.sort((a, b) => a.z - b.z);

    projected.forEach(b => {
      const alpha = b.z > 0 ? 1.0 : 0.35;  // 背面半透明
      const br = b.radius * b.scale * 0.9;

      // 气泡发光
      const glowR = ctx.createRadialGradient(b.sx, b.sy, 0, b.sx, b.sy, br * 2.2);
      glowR.addColorStop(0, b.color.replace(')', `,${alpha * 0.25})`).replace('rgb', 'rgba').replace('#', 'rgba(').replace(/^rgba\(([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2}),/, (_, r, g, bv) => `rgba(${parseInt(r,16)},${parseInt(g,16)},${parseInt(bv,16)},`));
      glowR.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(b.sx, b.sy, br * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = glowR;
      ctx.fill();

      // 气泡主体
      ctx.beginPath();
      ctx.arc(b.sx, b.sy, br, 0, Math.PI * 2);
      ctx.fillStyle = this._hexToRgba(b.color, alpha * 0.75);
      ctx.fill();
      ctx.strokeStyle = this._hexToRgba(b.color, alpha);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 气泡内文字（只显示 1-2 个字）
      if (br > 12) {
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.95})`;
        ctx.font = `bold ${Math.max(10, br * 0.65)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = b.title.length > 2 ? b.title.slice(0, 2) : b.title;
        ctx.fillText(label, b.sx, b.sy);
      }
    });

    // 缓存投影结果供点击检测
    this._projectedBubbles = projected;
  },

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  },

  // ── 触摸事件 ──────────────────────────────
  onTouchStart(e) {
    this._dragging = true;
    this._lastX = e.touches[0].clientX;
    this._lastY = e.touches[0].clientY;
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
    this._touchStartTime = Date.now();
  },

  onTouchMove(e) {
    if (!this._dragging) return;
    const dx = e.touches[0].clientX - this._lastX;
    const dy = e.touches[0].clientY - this._lastY;
    this._rotY += dx * 0.008;
    this._rotX += dy * 0.008;
    // 限制 X 轴旋转范围，避免翻转
    this._rotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this._rotX));
    this._lastX = e.touches[0].clientX;
    this._lastY = e.touches[0].clientY;
  },

  onTouchEnd(e) {
    this._dragging = false;
    // 判断是否为点击（移动距离小，时间短）
    const dx = Math.abs(e.changedTouches[0].clientX - this._touchStartX);
    const dy = Math.abs(e.changedTouches[0].clientY - this._touchStartY);
    const dt = Date.now() - this._touchStartTime;
    if (dx < 8 && dy < 8 && dt < 300) {
      this._handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
  },

  _handleTap(tapX, tapY) {
    if (!this._projectedBubbles) return;
    // 转换为 canvas 内坐标（减去 canvas 顶部偏移）
    // canvas 在页面中的 top 通过 getBoundingClientRect 获取
    const canvasTop = this._canvasTop || 0;
    const x = tapX;
    const y = tapY - canvasTop;

    for (let i = this._projectedBubbles.length - 1; i >= 0; i--) {
      const b = this._projectedBubbles[i];
      const dist = Math.sqrt((x - b.sx) ** 2 + (y - b.sy) ** 2);
      if (dist < b.radius * b.scale * 1.2) {
        wx.navigateTo({ url: `/pages/detail/detail?id=${b.id}` });
        return;
      }
    }
  },

  onCanvasLayout(e) {
    this._canvasTop = e.detail.height ? 0 : (e.currentTarget.offsetTop || 0);
    // 通过 query 获取精确位置
    wx.createSelectorQuery().select('#planetCanvas').boundingClientRect(rect => {
      if (rect) this._canvasTop = rect.top;
    }).exec();
  },

  onPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' });
  },

  onUnload() {
    if (this._animRAF && this._canvas) {
      // cancelAnimationFrame 在部分版本可用
    }
  }
});
