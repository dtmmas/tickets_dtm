export function computeDiff(oldData = {}, newData = {}) {
  try {
    const oldObj = typeof oldData === 'string' ? JSON.parse(oldData) : (oldData || {});
    const newObj = typeof newData === 'string' ? JSON.parse(newData) : (newData || {});
    const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

    return keys.map((k) => {
      const before = oldObj[k];
      const after = newObj[k];
      let changeType = 'unchanged';

      if (!(k in oldObj) && (k in newObj)) {
        changeType = 'added';
      } else if ((k in oldObj) && !(k in newObj)) {
        changeType = 'removed';
      } else if (JSON.stringify(before) !== JSON.stringify(after)) {
        changeType = 'changed';
      }

      return { key: k, before, after, changeType, changed: changeType !== 'unchanged' };
    });
  } catch (_) {
    return [];
  }
}