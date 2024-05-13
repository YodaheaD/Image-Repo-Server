import PusherClient from 'pusher-js'
import PusherServer from 'pusher'
import dotenv from 'dotenv'

dotenv.config()



export const pusherServer = new PusherServer({
   appId: String(process.env.NEXT_PUBLIC_PUSHER_ID),
    key: String(process.env.NEXT_PUBLIC_PUSHER_KEY),
    secret: String(process.env.NEXT_PUBLIC_PUSHER_SECRET),
    cluster: 'us2',
    useTLS: true
  }) 
  
  export const pusherClient = new PusherClient(
    process.env.NEXT_PUBLIC_PUSHER_KEY!,
    {cluster: 'us2'})