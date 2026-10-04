'use strict';

function corsConfig(){
  const allowed = process.env.CORS_ORIGIN || null;
  const isProd = process.env.NODE_ENV === 'production';
  return {
    origin(origin, cb){
      if(!origin) return cb(null, true);
      if(allowed) return cb(null, allowed === '*' ? true : origin === allowed);
      if(isProd) return cb(null, false);
      return cb(null, true);
    }
  };
}

module.exports = corsConfig;
