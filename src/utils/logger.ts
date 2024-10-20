import winston from "winston";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const level = () => {
  const env = process.env.NODE_ENV || 'development'
  const isDevelopment = env === 'development'
  return isDevelopment ? 'debug' : 'warn'
}
 

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  deep: 'white',
}
const formatMessage = (info:any) => {
  const { timestamp, level, message, ...extra } = info
  const ts = timestamp.slice(0, 19).replace('T', ' ')
  let holder = ''
  if(message.includes('Cache'  )){
    holder = 'Cache'
  }
  else if(message.includes('Done')||message.includes('Found')){
    holder = 'Success'
  }
  else if(message.includes('Logging')||message.includes('Auth')||message.includes('auth')){
    holder = 'Auth'
  }
  else if(message.includes('admin')||message.includes('Admin')){
    holder = 'Admin'
  }
  else{
    holder = 'Info'
  }
   return `${ts} [${holder}]: ${message} ${Object.keys(extra).length ? JSON.stringify(extra, null, 2) : ''}`
}
winston.addColors( colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: "MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => formatMessage(info)  
     
  )
);
// Fucntion to add submessage to winston logger
// const submessage = (info) => {
//   if (info.message) {
//     info.message = `${info.message}`;
//   }
//   return info;

const transports = [
  new winston.transports.Console(),
  /** new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/all.log' }),*/
];

const Logger = winston.createLogger({
  levels:  levels,

  format,
  transports,
});

export default Logger;
