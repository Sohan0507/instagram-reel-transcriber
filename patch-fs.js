const fs = require('fs');

// Patch fs.readlink
const originalReadlink = fs.readlink;
fs.readlink = function (path, options, callback) {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }
  originalReadlink(path, opts, (err, linkString) => {
    if (err && (err.code === 'EISDIR' || err.code === 'UNKNOWN' || err.code === 'EINVAL')) {
      const newErr = new Error(`EINVAL: invalid argument, readlink '${path}'`);
      newErr.code = 'EINVAL';
      newErr.errno = -4071;
      return cb(newErr);
    }
    cb(err, linkString);
  });
};

// Patch fs.readlinkSync
const originalReadlinkSync = fs.readlinkSync;
fs.readlinkSync = function (path, options) {
  try {
    return originalReadlinkSync(path, options);
  } catch (err) {
    if (err && (err.code === 'EISDIR' || err.code === 'UNKNOWN' || err.code === 'EINVAL')) {
      const newErr = new Error(`EINVAL: invalid argument, readlink '${path}'`);
      newErr.code = 'EINVAL';
      newErr.errno = -4071;
      throw newErr;
    }
    throw err;
  }
};

// Patch fs.promises.readlink
if (fs.promises && fs.promises.readlink) {
  const originalPromisesReadlink = fs.promises.readlink;
  fs.promises.readlink = function (path, options) {
    return originalPromisesReadlink(path, options).catch((err) => {
      if (err && (err.code === 'EISDIR' || err.code === 'UNKNOWN' || err.code === 'EINVAL')) {
        const newErr = new Error(`EINVAL: invalid argument, readlink '${path}'`);
        newErr.code = 'EINVAL';
        newErr.errno = -4071;
        throw newErr;
      }
      throw err;
    });
  };
}

console.log('[exFAT Patch] fs.readlink error monkey-patch applied.');
