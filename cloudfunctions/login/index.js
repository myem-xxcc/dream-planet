// cloudfunctions/login/index.js
// 职责：云函数 login —— 获取当前用户 openid，写入或更新用户记录，返回 openid

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  // 从云函数上下文中获取 openid（由微信平台注入，安全可信）
  const { OPENID } = cloud.getWXContext();
  const { nickName, avatarUrl } = event;

  if (!OPENID) {
    return { code: -1, message: '未获取到 openid' };
  }

  try {
    const now = new Date().toISOString();

    // 查询是否已有该用户
    const { data: existing } = await db.collection('users')
      .where({ openid: OPENID })
      .limit(1)
      .get();

    if (existing.length === 0) {
      // 新用户：创建记录
      await db.collection('users').add({
        data: {
          openid:    OPENID,
          nickName:  nickName  || '梦境旅人',
          avatarUrl: avatarUrl || '',
          createdAt: now,
          updatedAt: now,
        },
      });
    } else {
      // 已有用户：更新昵称和头像（允许用户在微信端改名后同步）
      await db.collection('users')
        .doc(existing[0]._id)
        .update({
          data: {
            nickName:  nickName  || existing[0].nickName,
            avatarUrl: avatarUrl || existing[0].avatarUrl,
            updatedAt: now,
          },
        });
    }

    return {
      code: 0,
      openid: OPENID,
      message: 'ok',
    };
  } catch (e) {
    console.error('login 云函数异常', e);
    return {
      code: -2,
      message: e.message || '服务器错误',
    };
  }
};
