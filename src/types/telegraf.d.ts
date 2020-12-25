declare module 'telegraf/stage';
declare module 'telegraf/scenes/base';
declare module 'telegraf/session' {
    export default function (opts?: any): (ctx: any, next: any) => any
}