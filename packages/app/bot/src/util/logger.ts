import winston, { format, LoggerOptions } from 'winston'
import { botConfig } from './bot-config'

const {combine, timestamp, printf} = format

function getFormat(): LoggerOptions['format'] {
    if (botConfig.NODE_ENV === 'development' || botConfig.NODE_ENV === 'test') {
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
            format.errors({stack: true}),
            format.colorize(),
            format.splat(),
            format.simple(),
            printf(({level, message, stack}) => {
                return `[${level}] ${message}${stack ? '- ' + stack : ''}`
            })
        )
    }
}

export const loggerTransport = new winston.transports.Console({
    level: botConfig.LOG_LEVEL
})

export const logger = winston.createLogger({
    transports: [
        loggerTransport
    ],
    format: getFormat()
})