declare module 'telegraf-update-logger' {
    export default function updateLogger(d: {
        log: (msg: string) => void
    }): any
}