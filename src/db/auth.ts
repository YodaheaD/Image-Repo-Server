import  TableLike  from "./mytablelike"

export interface authProps{
    partitionKey:string
    rowKey:string
    username:string
    password:string
    hashed?:string
    token?:string
    isLoggedIn?:string
}

export const AuthTable = new TableLike<authProps>("authJWT");