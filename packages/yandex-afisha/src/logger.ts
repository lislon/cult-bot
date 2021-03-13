import winston, { format } from 'winston'
import { appConfig } from './app-config'

const {combine, timestamp, printf} = format;
function getFormat() {
    if (appConfig.NODE_ENV === 'development' || appConfig.NODE_ENV === 'test') {
        return combine(
            format.errors({stack: true}),
            format.colorize(),
            timestamp({format: 'HH:mm:ss'}),
            format.splat(),
            format.simple(),
            printf(({timestamp, level, message, stack}) => {
                return `[${timestamp}] [${level}] ${message}${stack ? '- ' + stack : ''}`
            })
        )
    } else {
        return combine(
            format.json(),
        )
    }
}

export const loggerTransport = new winston.transports.Console()

export const logger = winston.createLogger({
    transports: [
        loggerTransport
    ],
    format: getFormat()
})