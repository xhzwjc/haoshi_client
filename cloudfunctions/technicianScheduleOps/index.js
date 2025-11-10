const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

async function ensureCollection(name) {
  try {
    await db.collection(name).limit(1).get();
  } catch (error) {
    if (error && error.errCode === -502005) {
      try {
        await db.createCollection(name);
      } catch (createErr) {
        const ignore = new Set([-502006, -501001]);
        if (!ignore.has(createErr.errCode)) {
          throw createErr;
        }
      }
    } else {
      throw error;
    }
  }
}

exports.main = async (event, context) => {
  const { action } = event || {};

  switch (action) {
    case 'ensureCollection':
    default:
      try {
        await ensureCollection('technician_schedules');
        return { code: 0, message: 'ok' };
      } catch (error) {
        console.error('technicianScheduleOps ensureCollection error', error);
        return { code: -1, message: error?.message || 'ensure failed', error };
      }
  }
};
